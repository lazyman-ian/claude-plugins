# Navigation in Jetpack Compose

Requires: `androidx.navigation:navigation-compose:2.8+` for type-safe routes.

## Type-Safe Navigation Setup

```kotlin
// 1. Define routes as @Serializable classes/objects
@Serializable data object HomeRoute
@Serializable data object SearchRoute
@Serializable data class ProfileRoute(val userId: String)
@Serializable data class PostRoute(
    val postId: String,
    val authorId: String,
    val preview: Boolean = false,
)

// 2. Build NavHost with typed composable<T>
@Composable
fun AppNavHost(
    navController: NavHostController = rememberNavController(),
    modifier: Modifier = Modifier,
) {
    NavHost(
        navController = navController,
        startDestination = HomeRoute,
        modifier = modifier,
    ) {
        composable<HomeRoute> {
            HomeScreen(
                onNavigateToProfile = { userId ->
                    navController.navigate(ProfileRoute(userId))
                },
            )
        }
        composable<ProfileRoute> { backStackEntry ->
            val route: ProfileRoute = backStackEntry.toRoute()
            ProfileScreen(
                userId = route.userId,
                onNavigateBack = { navController.popBackStack() },
            )
        }
        composable<PostRoute> { backStackEntry ->
            val route: PostRoute = backStackEntry.toRoute()
            PostScreen(
                postId = route.postId,
                authorId = route.authorId,
                isPreview = route.preview,
            )
        }
    }
}
```

## Passing Arguments

### Primitives and nullable types

```kotlin
@Serializable data class ArticleRoute(
    val articleId: String,
    val category: String? = null,   // nullable with default
    val page: Int = 0,              // default value
)

// Navigate with arguments
navController.navigate(ArticleRoute(articleId = "abc123", category = "tech"))
```

### Complex objects (require @Serializable)

```kotlin
@Serializable data class Filter(val minPrice: Int, val maxPrice: Int)
@Serializable data class SearchRoute(
    val query: String = "",
    val filter: Filter? = null,  // nested serializable
)
```

## Nested Navigation Graphs

```kotlin
// Define sub-graph route
@Serializable data object AuthGraph
@Serializable data object LoginRoute
@Serializable data object RegisterRoute

NavHost(navController, startDestination = HomeRoute) {
    composable<HomeRoute> { HomeScreen(...) }

    // Nested graph
    navigation<AuthGraph>(startDestination = LoginRoute) {
        composable<LoginRoute> { LoginScreen(...) }
        composable<RegisterRoute> { RegisterScreen(...) }
    }
}

// Navigate to nested graph
navController.navigate(AuthGraph)

// Navigate to specific screen within graph
navController.navigate(RegisterRoute)
```

## Bottom Navigation with NavigationSuiteScaffold

```kotlin
@Serializable enum class TopLevelRoute(val icon: ImageVector, val label: String) {
    HOME(Icons.Default.Home, "Home"),
    SEARCH(Icons.Default.Search, "Search"),
    PROFILE(Icons.Default.Person, "Profile"),
}

@Composable
fun MainScreen() {
    val navController = rememberNavController()
    val currentDestination by navController.currentBackStackEntryAsState()

    NavigationSuiteScaffold(
        navigationSuiteItems = {
            TopLevelRoute.entries.forEach { route ->
                item(
                    selected = currentDestination?.destination?.hasRoute(route::class) == true,
                    icon = { Icon(route.icon, contentDescription = route.label) },
                    label = { Text(route.label) },
                    onClick = {
                        navController.navigate(route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                )
            }
        }
    ) {
        NavHost(navController, startDestination = TopLevelRoute.HOME) {
            composable<TopLevelRoute.HOME> { HomeScreen() }
            composable<TopLevelRoute.SEARCH> { SearchScreen() }
            composable<TopLevelRoute.PROFILE> { ProfileScreen() }
        }
    }
}
```

## Deep Linking

```kotlin
@Serializable data class ArticleRoute(val articleId: String)

composable<ArticleRoute>(
    deepLinks = listOf(
        navDeepLink<ArticleRoute>(basePath = "https://myapp.com/articles")
    )
) { backStackEntry ->
    ArticleScreen(backStackEntry.toRoute<ArticleRoute>().articleId)
}

// AndroidManifest.xml
// <intent-filter android:autoVerify="true">
//   <action android:name="android.intent.action.VIEW" />
//   <category android:name="android.intent.category.DEFAULT" />
//   <category android:name="android.intent.category.BROWSABLE" />
//   <data android:scheme="https" android:host="myapp.com" android:pathPrefix="/articles" />
// </intent-filter>
```

## Navigation Testing

```kotlin
@Test
fun navigatesToProfile_whenProfileClicked() {
    val navController = TestNavHostController(ApplicationProvider.getApplicationContext())
    navController.navigatorProvider.addNavigator(ComposeNavigator())

    composeTestRule.setContent {
        AppNavHost(navController = navController)
    }

    composeTestRule.onNodeWithText("View Profile").performClick()

    val route = navController.currentBackStackEntry?.toRoute<ProfileRoute>()
    assertThat(route?.userId).isEqualTo("expected-user-id")
}
```

## Common Anti-patterns

```kotlin
// ❌ String routes — no type safety, typos cause crashes at runtime
navController.navigate("profile/user123?tab=posts")
composable("profile/{userId}?tab={tab}") { ... }

// ✅ Type-safe routes
navController.navigate(ProfileRoute(userId = "user123", tab = "posts"))
composable<ProfileRoute> { ... }

// ❌ Passing ViewModel through navigation
navController.navigate(ProfileRoute(viewModel = someViewModel))  // crashes

// ✅ Pass only IDs; each screen creates its own ViewModel
navController.navigate(ProfileRoute(userId = "user123"))

// ❌ Accessing NavController in ViewModel
class MyViewModel(val navController: NavController) : ViewModel()  // memory leak

// ✅ Use effects/channels to communicate navigation intent
sealed interface MyEffect { data class NavigateTo(val route: Any) : MyEffect }
```
