/**
 * Detector module tests
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  detectPlatformSimple,
  loadProjectConfig,
  hasMakefileTargets,
  detectProjectType,
} from './detector';

vi.mock('fs');
vi.mock('path', async () => {
  const actual = await vi.importActual<typeof path>('path');
  return { ...actual };
});

const mockFs = vi.mocked(fs);

function setupMockFs(files: string[], extras: Record<string, string | boolean> = {}) {
  mockFs.readdirSync.mockReturnValue(files as unknown as fs.Dirent[]);
  mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
    const str = p.toString();
    if (str in extras) return !!extras[str];
    return false;
  });
  mockFs.readFileSync.mockImplementation((p: fs.PathOrFileDescriptor, _opts?: unknown) => {
    const str = p.toString();
    if (str in extras && typeof extras[str] === 'string') return extras[str] as string;
    throw new Error(`ENOENT: ${str}`);
  });
}

describe('loadProjectConfig', () => {
  beforeEach(() => vi.resetAllMocks());

  test('returns null when .dev-flow.json does not exist', () => {
    mockFs.existsSync.mockReturnValue(false);
    expect(loadProjectConfig('/some/project')).toBeNull();
  });

  test('returns config when valid .dev-flow.json exists', () => {
    const config = {
      platform: 'python',
      commands: { fix: 'black .', check: 'ruff check .' },
    };
    const configPath = '/some/project/.dev-flow.json';
    mockFs.existsSync.mockImplementation((p) => p.toString() === configPath);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(config));

    const result = loadProjectConfig('/some/project');
    expect(result).not.toBeNull();
    expect(result?.platform).toBe('python');
    expect(result?.commands.fix).toBe('black .');
  });

  test('returns null when config is missing required fields', () => {
    const configPath = '/some/project/.dev-flow.json';
    mockFs.existsSync.mockImplementation((p) => p.toString() === configPath);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ platform: 'python' }));

    expect(loadProjectConfig('/some/project')).toBeNull();
  });

  test('returns null when JSON is malformed', () => {
    const configPath = '/some/project/.dev-flow.json';
    mockFs.existsSync.mockImplementation((p) => p.toString() === configPath);
    mockFs.readFileSync.mockReturnValue('{ bad json }');

    expect(loadProjectConfig('/some/project')).toBeNull();
  });
});

describe('hasMakefileTargets', () => {
  beforeEach(() => vi.resetAllMocks());

  test('returns false when Makefile does not exist', () => {
    mockFs.existsSync.mockReturnValue(false);
    expect(hasMakefileTargets('/some/project')).toBe(false);
  });

  test('returns true when Makefile has fix: and check: targets', () => {
    const makefilePath = '/some/project/Makefile';
    mockFs.existsSync.mockImplementation((p) => p.toString() === makefilePath);
    mockFs.readFileSync.mockReturnValue('fix:\n\techo fix\n\ncheck:\n\techo check\n');

    expect(hasMakefileTargets('/some/project')).toBe(true);
  });

  test('returns false when Makefile is missing check: target', () => {
    const makefilePath = '/some/project/Makefile';
    mockFs.existsSync.mockImplementation((p) => p.toString() === makefilePath);
    mockFs.readFileSync.mockReturnValue('fix:\n\techo fix\n');

    expect(hasMakefileTargets('/some/project')).toBe(false);
  });

  test('returns false when Makefile is missing fix: target', () => {
    const makefilePath = '/some/project/Makefile';
    mockFs.existsSync.mockImplementation((p) => p.toString() === makefilePath);
    mockFs.readFileSync.mockReturnValue('check:\n\techo check\n');

    expect(hasMakefileTargets('/some/project')).toBe(false);
  });
});

describe('detectProjectType', () => {
  beforeEach(() => vi.resetAllMocks());

  test('detects iOS project via .xcodeproj', () => {
    setupMockFs(['MyApp.xcodeproj', 'Podfile']);
    const result = detectProjectType('/ios/project');
    expect(result.type).toBe('ios');
    expect(result.name).toBe('MyApp');
  });

  test('detects iOS project via .xcworkspace', () => {
    setupMockFs(['MyApp.xcworkspace']);
    const result = detectProjectType('/ios/project');
    expect(result.type).toBe('ios');
  });

  test('detects Android project via build.gradle', () => {
    setupMockFs(['build.gradle', 'settings.gradle']);
    const result = detectProjectType('/android/project');
    expect(result.type).toBe('android');
    expect(result.srcDir).toBe('app/src/main');
  });

  test('detects Android project via build.gradle.kts', () => {
    setupMockFs(['build.gradle.kts', 'settings.gradle.kts']);
    const result = detectProjectType('/android/project');
    expect(result.type).toBe('android');
  });

  test('returns unknown for empty directory', () => {
    setupMockFs([]);
    const result = detectProjectType('/empty/project');
    expect(result.type).toBe('unknown');
    expect(result.srcDir).toBe('.');
    expect(result.configFiles).toHaveLength(0);
  });

  test('iOS result includes Podfile in configFiles', () => {
    setupMockFs(['MyApp.xcodeproj', 'Podfile']);
    const result = detectProjectType('/ios/project');
    expect(result.configFiles).toContain('Podfile');
  });
});

describe('detectPlatformSimple', () => {
  beforeEach(() => vi.resetAllMocks());

  test('returns platform from .dev-flow.json (highest priority)', () => {
    const config = {
      platform: 'python',
      commands: { fix: 'black .', check: 'ruff check .' },
    };
    const configPath = '/my/project/.dev-flow.json';
    mockFs.existsSync.mockImplementation((p) => p.toString() === configPath);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(config));
    mockFs.readdirSync.mockReturnValue(['build.gradle'] as unknown as fs.Dirent[]);

    // Even though build.gradle exists, .dev-flow.json wins
    const result = detectPlatformSimple('/my/project');
    expect(result).toBe('python');
  });

  test('returns ios for .xcodeproj project', () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readdirSync.mockReturnValue(['MyApp.xcodeproj'] as unknown as fs.Dirent[]);

    expect(detectPlatformSimple('/ios/project')).toBe('ios');
  });

  test('returns ios for .xcworkspace project', () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readdirSync.mockReturnValue(['MyApp.xcworkspace'] as unknown as fs.Dirent[]);

    expect(detectPlatformSimple('/ios/project')).toBe('ios');
  });

  test('returns ios for Podfile project', () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readdirSync.mockReturnValue(['Podfile'] as unknown as fs.Dirent[]);

    expect(detectPlatformSimple('/ios/project')).toBe('ios');
  });

  test('returns ios for Package.swift project', () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readdirSync.mockReturnValue(['Package.swift'] as unknown as fs.Dirent[]);

    expect(detectPlatformSimple('/swift/project')).toBe('ios');
  });

  test('returns android for build.gradle project', () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readdirSync.mockReturnValue(['build.gradle'] as unknown as fs.Dirent[]);

    expect(detectPlatformSimple('/android/project')).toBe('android');
  });

  test('returns android for build.gradle.kts project', () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readdirSync.mockReturnValue(['build.gradle.kts'] as unknown as fs.Dirent[]);

    expect(detectPlatformSimple('/android/project')).toBe('android');
  });

  test('returns web for package.json project', () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readdirSync.mockReturnValue(['package.json', 'src'] as unknown as fs.Dirent[]);

    expect(detectPlatformSimple('/web/project')).toBe('web');
  });

  test('returns general for empty directory', () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readdirSync.mockReturnValue([] as unknown as fs.Dirent[]);

    expect(detectPlatformSimple('/empty/project')).toBe('general');
  });

  test('returns general when directory does not exist', () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readdirSync.mockImplementation(() => { throw new Error('ENOENT'); });

    expect(detectPlatformSimple('/nonexistent')).toBe('general');
  });

  test('iOS takes priority over web (no package.json check reached)', () => {
    mockFs.existsSync.mockReturnValue(false);
    // Both xcodeproj and package.json present — iOS wins (checked first)
    mockFs.readdirSync.mockReturnValue(['MyApp.xcodeproj', 'package.json'] as unknown as fs.Dirent[]);

    expect(detectPlatformSimple('/mixed/project')).toBe('ios');
  });

  test('lowercases platform from .dev-flow.json', () => {
    const config = {
      platform: 'Python',
      commands: { fix: 'black .', check: 'ruff .' },
    };
    const configPath = '/my/project/.dev-flow.json';
    mockFs.existsSync.mockImplementation((p) => p.toString() === configPath);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(config));
    mockFs.readdirSync.mockReturnValue([] as unknown as fs.Dirent[]);

    expect(detectPlatformSimple('/my/project')).toBe('python');
  });

  test('returns custom platform string from .dev-flow.json (monorepo)', () => {
    const config = {
      platform: 'monorepo',
      commands: { fix: 'make fix', check: 'make check' },
    };
    const configPath = '/my/project/.dev-flow.json';
    mockFs.existsSync.mockImplementation((p) => p.toString() === configPath);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(config));
    mockFs.readdirSync.mockReturnValue([] as unknown as fs.Dirent[]);

    expect(detectPlatformSimple('/my/project')).toBe('monorepo');
  });
});
