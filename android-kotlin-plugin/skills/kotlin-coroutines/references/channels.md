# Kotlin Channels

Channels provide a way to transfer a stream of values between coroutines. Unlike Flow, they are hot and support both sending and receiving from different coroutines.

## Channel Types

| Type | Buffer | Behavior |
|------|--------|----------|
| `RENDEZVOUS` (default) | 0 | Sender suspends until receiver is ready |
| `BUFFERED` | 64 (configurable) | Sender suspends only when buffer is full |
| `CONFLATED` | 1 | Latest value only; sender never suspends |
| `UNLIMITED` | Unbounded | Sender never suspends (use with caution) |

```kotlin
// Rendezvous — synchronous handoff
val channel = Channel<Int>()

// Buffered — 64 slots by default
val buffered = Channel<Int>(capacity = Channel.BUFFERED)

// Custom capacity
val custom = Channel<Int>(capacity = 10)

// Conflated — only latest, never suspends
val conflated = Channel<Int>(capacity = Channel.CONFLATED)
```

## produce {} Builder

`produce {}` creates a `ReceiveChannel` and cancels the channel when the producer coroutine completes.

```kotlin
fun CoroutineScope.generateNumbers(): ReceiveChannel<Int> = produce {
    var n = 0
    while (true) {
        send(n++)
        delay(100)
    }
}

// Consumer
val numbers = generateNumbers()
repeat(5) {
    println(numbers.receive())  // 0, 1, 2, 3, 4
}
numbers.cancel()
```

## Channel vs SharedFlow

| Aspect | Channel | SharedFlow |
|--------|---------|------------|
| Collectors | One receiver per send | Multiple collectors |
| Backpressure | Sender suspends | Configurable overflow |
| Cancellation | Explicit close/cancel | Scope cancellation |
| Use case | One-to-one, work queues | One-to-many, broadcast |
| Replay | No | Configurable |
| From outside scope | Tricky | Easier (MutableSharedFlow) |

```kotlin
// Channel: one sender, one receiver — work queue
val workQueue = Channel<Task>(capacity = 16)

// SharedFlow: one sender, many collectors — event bus
val eventBus = MutableSharedFlow<AppEvent>(extraBufferCapacity = 8)
```

## Fan-Out (Multiple Receivers)

Multiple coroutines consume from a single channel. Each element is consumed by exactly one receiver.

```kotlin
fun CoroutineScope.launchWorkers(channel: ReceiveChannel<Task>, n: Int) {
    repeat(n) { workerId ->
        launch {
            for (task in channel) {                  // for loop handles cancellation
                println("Worker $workerId: $task")
                processTask(task)
            }
        }
    }
}

val taskChannel = Channel<Task>(capacity = 32)
launchWorkers(taskChannel, n = 4)

// Send work
taskChannel.send(Task("task-1"))
taskChannel.send(Task("task-2"))
taskChannel.close()                                  // workers finish when channel is closed
```

## Fan-In (Multiple Senders)

Multiple coroutines send to the same channel. A single receiver processes all output.

```kotlin
fun CoroutineScope.mergeChannels(vararg channels: ReceiveChannel<String>): ReceiveChannel<String> {
    val merged = Channel<String>()
    channels.forEach { ch ->
        launch {
            for (item in ch) merged.send(item)
        }
    }
    return merged
}

val ch1 = produce { repeat(3) { send("A$it"); delay(100) } }
val ch2 = produce { repeat(3) { send("B$it"); delay(150) } }
val merged = mergeChannels(ch1, ch2)
for (item in merged) println(item)
```

## Actor Pattern

An actor is a coroutine that processes messages from a channel sequentially, making state mutations safe without locks.

```kotlin
sealed class CounterMsg
object Increment : CounterMsg()
class GetCount(val response: CompletableDeferred<Int>) : CounterMsg()

fun CoroutineScope.counterActor(): SendChannel<CounterMsg> = actor {
    var counter = 0
    for (msg in channel) {
        when (msg) {
            is Increment -> counter++
            is GetCount -> msg.response.complete(counter)
        }
    }
}

// Usage
val actor = counterActor()
repeat(1000) { actor.send(Increment) }
val response = CompletableDeferred<Int>()
actor.send(GetCount(response))
println("Count: ${response.await()}")
actor.close()
```

## Channel Closing and Cancellation

Always close or cancel a channel when done. Failure to close prevents receivers from terminating.

```kotlin
val channel = Channel<Int>(10)

// Sender: close signals no more elements
launch {
    try {
        for (i in 1..5) channel.send(i)
    } finally {
        channel.close()          // always close in finally
    }
}

// Receiver: for loop exits when channel is closed
launch {
    for (item in channel) {      // exits cleanly on close
        process(item)
    }
}

// Cancel stops both send and receive
val job = launch {
    val ch = Channel<Int>()
    launch { ch.send(1) }
    launch { ch.receive() }
}
job.cancel()                     // cancels the channel implicitly

// Check if closed before sending
if (!channel.isClosedForSend) {
    channel.trySend(value)       // non-suspending, returns ChannelResult
}
```

## When to Use Channel vs Flow

| Use Channel | Use Flow |
|-------------|----------|
| Work queue (fan-out) | Data transformation pipelines |
| Actor pattern (state mutations) | UI state (StateFlow) |
| One-time events between coroutines | Reactive streams |
| Producer-consumer with backpressure | Search/filter pipelines |
| Multiple independent senders | Single upstream, multiple collectors |

```kotlin
// Channel: distribute tasks across workers
val imageProcessingQueue = Channel<Bitmap>(capacity = 32)

// Flow: reactive UI data
val profileFlow: StateFlow<Profile> = profileRepo.observe()
    .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), Profile.Empty)
```
