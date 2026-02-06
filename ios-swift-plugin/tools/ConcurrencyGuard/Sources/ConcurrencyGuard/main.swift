import ArgumentParser
import Foundation
import SwiftParser
import SwiftSyntax

@main
struct ConcurrencyGuard: ParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Detect Swift concurrency anti-patterns",
        version: "1.0.0"
    )

    @Flag(name: .long, help: "Read source from stdin")
    var stdin = false

    @Argument(help: "Swift files to analyze")
    var files: [String] = []

    mutating func run() throws {
        var violations: [Violation] = []

        if stdin {
            let source = readLine(strippingNewline: false) ?? ""
            var fullSource = source
            while let line = readLine(strippingNewline: false) {
                fullSource += line
            }
            violations += analyze(source: fullSource, filename: "<stdin>")
        } else {
            for file in files {
                let source = try String(contentsOfFile: file, encoding: .utf8)
                violations += analyze(source: source, filename: file)
            }
        }

        if violations.isEmpty {
            print("OK")
        } else {
            for v in violations {
                print("VIOLATION: \(v.code) at \(v.filename):\(v.line) - \(v.message)")
            }
            throw ExitCode.failure
        }
    }

    func analyze(source: String, filename: String) -> [Violation] {
        let sourceFile = Parser.parse(source: source)
        let visitor = ConcurrencyVisitor(filename: filename)
        visitor.walk(sourceFile)
        return visitor.violations
    }
}

struct Violation {
    let code: String
    let filename: String
    let line: Int
    let message: String
}

final class ConcurrencyVisitor: SyntaxVisitor {
    var violations: [Violation] = []
    let filename: String
    private var currentContext: String = ""
    private var taskCountInFunction: Int = 0

    init(filename: String) {
        self.filename = filename
        super.init(viewMode: .sourceAccurate)
    }

    // CC-CONC-001: Task.detached
    override func visit(_ node: MemberAccessExprSyntax) -> SyntaxVisitorContinueKind {
        if node.declName.baseName.text == "detached",
           let base = node.base?.as(DeclReferenceExprSyntax.self),
           base.baseName.text == "Task" {
            let line = lineNumber(for: node)
            violations.append(Violation(
                code: "CC-CONC-001",
                filename: filename,
                line: line,
                message: "Task.detached usage - prefer structured concurrency"
            ))
        }
        return .visitChildren
    }

    // Track function context for CC-CONC-002, CC-CONC-003, CC-CONC-005
    override func visit(_ node: InitializerDeclSyntax) -> SyntaxVisitorContinueKind {
        currentContext = "init"
        taskCountInFunction = 0
        return .visitChildren
    }

    override func visitPost(_ node: InitializerDeclSyntax) {
        currentContext = ""
    }

    override func visit(_ node: FunctionDeclSyntax) -> SyntaxVisitorContinueKind {
        let name = node.name.text
        if name == "body" || name == "layoutSubviews" || name == "updateUIView" {
            currentContext = "render"
        } else {
            currentContext = "function"
        }
        taskCountInFunction = 0
        return .visitChildren
    }

    override func visitPost(_ node: FunctionDeclSyntax) {
        // CC-CONC-005: Too many concurrent tasks
        if taskCountInFunction > 3 {
            let line = lineNumber(for: node)
            violations.append(Violation(
                code: "CC-CONC-005",
                filename: filename,
                line: line,
                message: "Too many concurrent Tasks (\(taskCountInFunction)) in single function"
            ))
        }
        currentContext = ""
    }

    override func visit(_ node: VariableDeclSyntax) -> SyntaxVisitorContinueKind {
        // Check for computed property `body`
        for binding in node.bindings {
            if let pattern = binding.pattern.as(IdentifierPatternSyntax.self),
               pattern.identifier.text == "body",
               binding.accessorBlock != nil {
                currentContext = "render"
            }
        }
        return .visitChildren
    }

    // Detect Task {} calls
    override func visit(_ node: FunctionCallExprSyntax) -> SyntaxVisitorContinueKind {
        if let callee = node.calledExpression.as(DeclReferenceExprSyntax.self),
           callee.baseName.text == "Task" {
            taskCountInFunction += 1

            // CC-CONC-002: Task in init
            if currentContext == "init" {
                let line = lineNumber(for: node)
                violations.append(Violation(
                    code: "CC-CONC-002",
                    filename: filename,
                    line: line,
                    message: "Task {} in initializer - causes side effects during init"
                ))
            }

            // CC-CONC-003: Task in render path
            if currentContext == "render" {
                let line = lineNumber(for: node)
                violations.append(Violation(
                    code: "CC-CONC-003",
                    filename: filename,
                    line: line,
                    message: "Task {} in render/layout path - may block UI"
                ))
            }

            // CC-CONC-008: Check for .background priority
            for arg in node.arguments {
                if arg.label?.text == "priority",
                   let memberAccess = arg.expression.as(MemberAccessExprSyntax.self),
                   memberAccess.declName.baseName.text == "background" {
                    // Check if this is in a for-await context (simplified)
                    let line = lineNumber(for: node)
                    violations.append(Violation(
                        code: "CC-CONC-008",
                        filename: filename,
                        line: line,
                        message: ".background priority may cause priority inversion"
                    ))
                }
            }
        }

        // CC-CONC-004: AsyncStream without onTermination
        if let callee = node.calledExpression.as(DeclReferenceExprSyntax.self),
           callee.baseName.text == "AsyncStream" {
            let hasOnTermination = node.arguments.contains { arg in
                arg.label?.text == "onTermination"
            }
            if !hasOnTermination {
                let line = lineNumber(for: node)
                violations.append(Violation(
                    code: "CC-CONC-004",
                    filename: filename,
                    line: line,
                    message: "AsyncStream without onTermination handler - may leak resources"
                ))
            }
        }

        return .visitChildren
    }

    private func lineNumber(for node: some SyntaxProtocol) -> Int {
        let location = node.startLocation(converter: SourceLocationConverter(
            fileName: filename,
            tree: node.root
        ))
        return location.line
    }
}
