# Typed Throws (SE-0413)

Swift 6 allows functions to declare the specific error type they throw, enabling exhaustive catch blocks.

## Syntax

### Functions

```swift
enum ValidationError: Error {
    case tooShort(minimum: Int)
    case tooLong(maximum: Int)
    case invalidCharacters
}

func validate(name: String) throws(ValidationError) -> String {
    guard name.count >= 2 else { throw .tooShort(minimum: 2) }
    guard name.count <= 50 else { throw .tooLong(maximum: 50) }
    guard name.allSatisfy(\.isLetter) else { throw .invalidCharacters }
    return name
}
```

### Closures

```swift
let parser: (String) throws(ParseError) -> AST = { input in
    guard !input.isEmpty else { throw .emptyInput }
    return try parse(input)
}
```

### Computed Properties

```swift
struct Config {
    var port: Int {
        get throws(ConfigError) {
            guard let raw = env["PORT"], let p = Int(raw) else {
                throw .missingKey("PORT")
            }
            return p
        }
    }
}
```

## Exhaustive Catch

When the error type is known, the compiler verifies all cases are handled:

```swift
do {
    let name = try validate(name: input)
    print("Valid: \(name)")
} catch .tooShort(let min) {
    print("Name must be at least \(min) characters")
} catch .tooLong(let max) {
    print("Name must be at most \(max) characters")
} catch .invalidCharacters {
    print("Name must contain only letters")
}
// No `default` needed — compiler knows all cases covered
```

Adding a new case to `ValidationError` produces a compile error at every catch site — same safety as `switch` on enums.

## Converting Existing Code

### From Untyped to Typed

```swift
// Before: untyped
func load() throws -> Data {
    guard let url = Bundle.main.url(forResource: "data", withExtension: "json") else {
        throw NSError(domain: "Load", code: 1)
    }
    return try Data(contentsOf: url)
}

// After: typed
enum LoadError: Error {
    case resourceNotFound(name: String)
    case readFailed(underlying: any Error)
}

func load() throws(LoadError) -> Data {
    guard let url = Bundle.main.url(forResource: "data", withExtension: "json") else {
        throw .resourceNotFound(name: "data.json")
    }
    do {
        return try Data(contentsOf: url)
    } catch {
        throw .readFailed(underlying: error)
    }
}
```

### Calling Untyped from Typed

When a typed-throw function calls an untyped-throw function, wrap in `do/catch`:

```swift
func fetchUser() throws(AppError) -> User {
    do {
        return try JSONDecoder().decode(User.self, from: data)
    } catch {
        throw .decodingFailed(error)
    }
}
```

## Generic Typed Throws

Functions can be generic over the error type:

```swift
func retry<E: Error, T>(
    attempts: Int,
    operation: () throws(E) -> T
) throws(E) -> T {
    var lastError: E?
    for _ in 0..<attempts {
        do {
            return try operation()
        } catch {
            lastError = error
        }
    }
    throw lastError!
}
```

### Map / FlatMap with Typed Throws

```swift
extension Array {
    func tryMap<T, E: Error>(
        _ transform: (Element) throws(E) -> T
    ) throws(E) -> [T] {
        var result: [T] = []
        for element in self {
            result.append(try transform(element))
        }
        return result
    }
}
```

## Rethrows and Typed Throws

`rethrows` works with typed throws — the compiler infers the thrown type:

```swift
func withLogging<T, E: Error>(
    _ body: () throws(E) -> T
) throws(E) -> T {
    print("Starting operation")
    let result = try body()
    print("Completed")
    return result
}

// Inferred: throws(NetworkError)
let data = try withLogging { try fetch(url: endpoint) }
```

## `Never` as Error Type

`throws(Never)` is equivalent to non-throwing:

```swift
func safeCompute() throws(Never) -> Int {
    return 42 // Cannot throw
}

// Can call without `try`
let value = safeCompute()
```

## When to Use Typed vs Untyped Throws

| Scenario | Recommendation |
|----------|---------------|
| Public library API | Untyped — allows adding error cases without breaking |
| Internal module boundary | Typed — callers benefit from exhaustive catching |
| Stable error domain | Typed — error cases unlikely to change |
| Wrapping external errors | Untyped or typed with `.other(any Error)` case |
| Protocol requirements | Consider typed if all conformers share error type |
| Async sequences | Typed — `AsyncThrowingStream<Element, ErrorType>` |

## Interaction with `Result`

`Result<Success, Failure>` maps directly to typed throws:

```swift
func parse(json: Data) throws(ParseError) -> Model {
    // ...
}

// Convert to Result
let result: Result<Model, ParseError> = Result { try parse(json: data) }

// Convert from Result
let model = try result.get() // throws(ParseError)
```

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| Throwing wrong error type | Compiler error — must match declared type |
| Forgetting to wrap untyped calls | Add `do/catch` and convert to your error type |
| Over-specifying in public API | Use untyped throws for evolving APIs |
| Large enum with 20+ cases | Split into nested enums or use untyped |
