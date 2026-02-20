# Platform-Specific Test Patterns

## Swift — XCTest / Swift Testing

### XCTest (traditional)

```swift
import XCTest
@testable import MyApp

final class UserServiceTests: XCTestCase {

    private var sut: UserService!
    private var mockRepository: MockUserRepository!

    override func setUp() {
        super.setUp()
        mockRepository = MockUserRepository()
        sut = UserService(repository: mockRepository)
    }

    override func tearDown() {
        sut = nil
        mockRepository = nil
        super.tearDown()
    }

    func test_fetchUser_withValidId_returnsUser() async throws {
        mockRepository.stubbedUser = User(id: "1", name: "Alice")

        let user = try await sut.fetchUser(id: "1")

        XCTAssertEqual(user.name, "Alice")
    }

    func test_fetchUser_withInvalidId_throwsNotFound() async {
        mockRepository.stubbedError = ServiceError.notFound

        do {
            _ = try await sut.fetchUser(id: "bad")
            XCTFail("Expected error")
        } catch {
            XCTAssertEqual(error as? ServiceError, .notFound)
        }
    }
}
```

### Swift Testing (iOS 18+ / Swift 6)

```swift
import Testing
@testable import MyApp

@Suite("UserService")
struct UserServiceTests {

    @Test("fetch user with valid ID returns user")
    func fetchUserValid() async throws {
        let repo = MockUserRepository()
        repo.stubbedUser = User(id: "1", name: "Alice")
        let sut = UserService(repository: repo)

        let user = try await sut.fetchUser(id: "1")

        #expect(user.name == "Alice")
    }

    @Test("fetch user with invalid ID throws not found")
    func fetchUserInvalid() async {
        let repo = MockUserRepository()
        repo.stubbedError = ServiceError.notFound
        let sut = UserService(repository: repo)

        await #expect(throws: ServiceError.notFound) {
            try await sut.fetchUser(id: "bad")
        }
    }
}
```

### @MainActor tests

```swift
@MainActor
func test_viewModel_updatesPublishedProperty() async {
    let vm = ProfileViewModel(service: mockService)

    await vm.loadProfile()

    XCTAssertEqual(vm.displayName, "Alice")
}
```

### Mock pattern (protocol-based)

```swift
protocol UserRepositoryProtocol {
    func fetchUser(id: String) async throws -> User
}

final class MockUserRepository: UserRepositoryProtocol {
    var stubbedUser: User?
    var stubbedError: Error?
    var fetchCallCount = 0

    func fetchUser(id: String) async throws -> User {
        fetchCallCount += 1
        if let error = stubbedError { throw error }
        return stubbedUser!
    }
}
```

---

## Kotlin — JUnit5 + MockK

### Basic test

```kotlin
import io.mockk.*
import org.junit.jupiter.api.*
import org.junit.jupiter.api.Assertions.*

class UserServiceTest {

    private val repository = mockk<UserRepository>()
    private val sut = UserService(repository)

    @Test
    fun `fetchUser with valid id returns user`() {
        every { repository.findById("1") } returns User("1", "Alice")

        val user = sut.fetchUser("1")

        assertEquals("Alice", user.name)
        verify(exactly = 1) { repository.findById("1") }
    }

    @Test
    fun `fetchUser with invalid id throws NotFoundException`() {
        every { repository.findById("bad") } throws NotFoundException()

        assertThrows<NotFoundException> {
            sut.fetchUser("bad")
        }
    }
}
```

### Coroutine tests

```kotlin
import kotlinx.coroutines.test.runTest

@Test
fun `async fetchUser returns user`() = runTest {
    coEvery { repository.fetchUser("1") } returns User("1", "Alice")

    val user = sut.fetchUser("1")

    assertEquals("Alice", user.name)
}
```

### Parameterized tests

```kotlin
@ParameterizedTest
@CsvSource("1,Alice", "2,Bob", "3,Charlie")
fun `fetchUser returns correct name`(id: String, expectedName: String) {
    every { repository.findById(id) } returns User(id, expectedName)

    val user = sut.fetchUser(id)

    assertEquals(expectedName, user.name)
}
```

---

## Python — pytest

### Basic test

```python
import pytest
from myapp.services import UserService

class TestUserService:
    def setup_method(self):
        self.repo = FakeUserRepository()
        self.sut = UserService(repository=self.repo)

    def test_fetch_user_returns_user(self):
        self.repo.add(User(id="1", name="Alice"))

        user = self.sut.fetch_user("1")

        assert user.name == "Alice"

    def test_fetch_user_raises_not_found(self):
        with pytest.raises(NotFoundError):
            self.sut.fetch_user("bad")
```

### Fixtures

```python
@pytest.fixture
def user_service():
    repo = FakeUserRepository()
    repo.add(User(id="1", name="Alice"))
    return UserService(repository=repo)

def test_fetch_user(user_service):
    user = user_service.fetch_user("1")
    assert user.name == "Alice"
```

### Parametrize

```python
@pytest.mark.parametrize("user_id,expected_name", [
    ("1", "Alice"),
    ("2", "Bob"),
])
def test_fetch_user_returns_correct_name(user_service, user_id, expected_name):
    user = user_service.fetch_user(user_id)
    assert user.name == expected_name
```

### Async tests

```python
import pytest

@pytest.mark.asyncio
async def test_fetch_user_async(user_service):
    user = await user_service.fetch_user_async("1")
    assert user.name == "Alice"
```

---

## TypeScript — Vitest / Jest

### Vitest

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from './user-service';

describe('UserService', () => {
  let mockRepo: { findById: ReturnType<typeof vi.fn> };
  let sut: UserService;

  beforeEach(() => {
    mockRepo = { findById: vi.fn() };
    sut = new UserService(mockRepo);
  });

  it('returns user for valid id', async () => {
    mockRepo.findById.mockResolvedValue({ id: '1', name: 'Alice' });

    const user = await sut.fetchUser('1');

    expect(user.name).toBe('Alice');
  });

  it('throws for invalid id', async () => {
    mockRepo.findById.mockRejectedValue(new NotFoundError());

    await expect(sut.fetchUser('bad')).rejects.toThrow(NotFoundError);
  });
});
```

### Jest (differences from Vitest)

```typescript
// Import from jest globals (or no import if using @jest/globals)
import { jest } from '@jest/globals';

// Mock modules
jest.mock('./user-repository');

// Spy pattern
const spy = jest.spyOn(service, 'validate');
expect(spy).toHaveBeenCalledWith('1');
```

### Mock patterns

```typescript
// Partial mock — only mock what you need
const mockRepo: Pick<UserRepository, 'findById'> = {
  findById: vi.fn(),
};

// Module mock
vi.mock('./config', () => ({
  getConfig: () => ({ apiUrl: 'http://test' }),
}));
```

---

## Go — Table-Driven Tests

### Basic test

```go
func TestFetchUser(t *testing.T) {
    repo := &FakeUserRepository{
        users: map[string]User{"1": {ID: "1", Name: "Alice"}},
    }
    svc := NewUserService(repo)

    user, err := svc.FetchUser("1")

    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if user.Name != "Alice" {
        t.Errorf("got %q, want %q", user.Name, "Alice")
    }
}
```

### Table-driven tests

```go
func TestFetchUser(t *testing.T) {
    repo := &FakeUserRepository{
        users: map[string]User{"1": {ID: "1", Name: "Alice"}},
    }
    svc := NewUserService(repo)

    tests := []struct {
        name    string
        id      string
        want    string
        wantErr bool
    }{
        {"valid id", "1", "Alice", false},
        {"invalid id", "bad", "", true},
        {"empty id", "", "", true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            user, err := svc.FetchUser(tt.id)
            if (err != nil) != tt.wantErr {
                t.Fatalf("error = %v, wantErr %v", err, tt.wantErr)
            }
            if !tt.wantErr && user.Name != tt.want {
                t.Errorf("got %q, want %q", user.Name, tt.want)
            }
        })
    }
}
```

### testify (optional)

```go
import "github.com/stretchr/testify/assert"

func TestFetchUser(t *testing.T) {
    user, err := svc.FetchUser("1")

    assert.NoError(t, err)
    assert.Equal(t, "Alice", user.Name)
}
```

### Interface-based mocks

```go
type UserRepository interface {
    FindByID(id string) (User, error)
}

type FakeUserRepository struct {
    users map[string]User
}

func (f *FakeUserRepository) FindByID(id string) (User, error) {
    u, ok := f.users[id]
    if !ok {
        return User{}, ErrNotFound
    }
    return u, nil
}
```
