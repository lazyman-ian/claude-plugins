# Testing Jetpack Compose

## Setup

```kotlin
// build.gradle.kts (app)
androidTestImplementation("androidx.compose.ui:ui-test-junit4")
debugImplementation("androidx.compose.ui:ui-test-manifest")

// For Robolectric (unit tests without emulator)
testImplementation("org.robolectric:robolectric:4.12.2")
testImplementation("androidx.compose.ui:ui-test-junit4")
```

```kotlin
// Instrumented test
@RunWith(AndroidJUnit4::class)
class MyScreenTest {
    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun myTest() {
        composeTestRule.setContent {
            AppTheme { MyScreen() }
        }
        // ...
    }
}

// With Activity (for window insets, theme from manifest)
@get:Rule
val composeTestRule = createAndroidComposeRule<ComponentActivity>()
```

## Semantic Matchers

```kotlin
// Find by text content
composeTestRule.onNodeWithText("Submit")
composeTestRule.onNodeWithText("Submit", ignoreCase = true)
composeTestRule.onAllNodesWithText("Item")

// Find by content description (for icons/images)
composeTestRule.onNodeWithContentDescription("Close dialog")

// Find by test tag (preferred for non-text elements)
composeTestRule.onNodeWithTag("search_field")
composeTestRule.onAllNodesWithTag("list_item")

// Find by role
composeTestRule.onNode(hasRole(Role.Button))

// Combined matchers
composeTestRule.onNode(hasText("Submit") and hasClickAction())
composeTestRule.onNode(isToggleable() and isOn())

// Parent/sibling/child traversal
composeTestRule.onNodeWithTag("card")
    .onChild()
    .onNodeWithText("Title")
```

## Actions

```kotlin
// Click
composeTestRule.onNodeWithText("Submit").performClick()

// Text input
composeTestRule.onNodeWithTag("search_field").performTextInput("query")
composeTestRule.onNodeWithTag("search_field").performTextClearance()
composeTestRule.onNodeWithTag("search_field").performTextReplacement("new text")

// Scroll
composeTestRule.onNodeWithTag("lazy_list").performScrollToIndex(10)
composeTestRule.onNodeWithTag("lazy_list").performScrollToNode(hasText("Target"))
composeTestRule.onNodeWithTag("scroll_content").performScrollTo()

// Gesture
composeTestRule.onNodeWithTag("item").performTouchInput { swipeLeft() }
composeTestRule.onNodeWithTag("item").performTouchInput { longClick() }

// IME
composeTestRule.onNodeWithTag("search_field").performImeAction()
```

## Assertions

```kotlin
// Visibility
composeTestRule.onNodeWithText("Loading...").assertIsDisplayed()
composeTestRule.onNodeWithText("Error").assertDoesNotExist()
composeTestRule.onNodeWithTag("hidden_item").assertIsNotDisplayed()

// Content
composeTestRule.onNodeWithTag("title").assertTextEquals("My Article")
composeTestRule.onNodeWithTag("title").assertTextContains("Article")

// State
composeTestRule.onNodeWithTag("checkbox").assertIsToggleable()
composeTestRule.onNodeWithTag("checkbox").assertIsOn()
composeTestRule.onNodeWithTag("button").assertIsEnabled()
composeTestRule.onNodeWithTag("button").assertIsNotEnabled()

// Count
composeTestRule.onAllNodesWithTag("list_item").assertCountEquals(5)
```

## Test Tags

```kotlin
// Add test tags to composables for reliable test targeting
@Composable
fun SearchField(
    query: String,
    onQueryChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    TextField(
        value = query,
        onValueChange = onQueryChange,
        modifier = modifier.testTag("search_field"),
    )
}

// Constants to avoid magic strings
object TestTags {
    const val SEARCH_FIELD = "search_field"
    const val SUBMIT_BUTTON = "submit_button"
    const val RESULT_LIST = "result_list"
}
```

## Testing State Changes

```kotlin
@Test
fun displaysResults_afterSearch() {
    val viewModel = SearchViewModel(FakeSearchRepository())

    composeTestRule.setContent {
        AppTheme { SearchScreen(viewModel = viewModel) }
    }

    // Enter query
    composeTestRule.onNodeWithTag(TestTags.SEARCH_FIELD)
        .performTextInput("android")

    // Submit
    composeTestRule.onNodeWithTag(TestTags.SUBMIT_BUTTON)
        .performClick()

    // Verify results appear
    composeTestRule.onAllNodesWithTag("result_item")
        .assertCountEquals(3)
}
```

## Testing Navigation

```kotlin
@Test
fun navigatesToDetail_onItemClick() {
    val navController = TestNavHostController(
        ApplicationProvider.getApplicationContext()
    ).apply {
        navigatorProvider.addNavigator(ComposeNavigator())
    }

    composeTestRule.setContent {
        AppNavHost(navController = navController)
    }

    composeTestRule.onNodeWithText("First Item").performClick()

    val route = navController.currentBackStackEntry?.toRoute<DetailRoute>()
    assertThat(route?.itemId).isEqualTo("first-item-id")
}
```

## Screenshot Testing with Roborazzi

```kotlin
// build.gradle.kts
testImplementation("io.github.takahirom.roborazzi:roborazzi:1.x.x")
testImplementation("io.github.takahirom.roborazzi:roborazzi-compose:1.x.x")

// Test
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ArticleCardScreenshotTest {
    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun articleCard_lightTheme() {
        composeTestRule.setContent {
            AppTheme(darkTheme = false) {
                ArticleCard(title = "Test", author = "Author", onClick = {})
            }
        }
        composeTestRule.onRoot().captureRoboImage("src/test/snapshots/article_card_light.png")
    }
}
```

## Robolectric + Compose (Unit Tests Without Emulator)

```kotlin
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class SearchScreenTest {
    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun searchField_acceptsInput() {
        composeTestRule.setContent {
            AppTheme { SearchScreen() }
        }
        composeTestRule.onNodeWithTag(TestTags.SEARCH_FIELD).performTextInput("test")
        composeTestRule.onNodeWithTag(TestTags.SEARCH_FIELD).assertTextEquals("test")
    }
}
```
