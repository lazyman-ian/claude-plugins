# UICollectionView Reference

## Basic Setup with Compositional Layout

```swift
class MyCollectionViewController: UIViewController {

    private var collectionView: UICollectionView!
    private var dataSource: UICollectionViewDiffableDataSource<Section, Item>!

    override func viewDidLoad() {
        super.viewDidLoad()
        setupCollectionView()
        configureDataSource()
    }

    private func setupCollectionView() {
        collectionView = UICollectionView(frame: view.bounds, collectionViewLayout: createLayout())
        collectionView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        collectionView.register(MyCell.self, forCellWithReuseIdentifier: MyCell.identifier)
        view.addSubview(collectionView)
    }
}
```

## Compositional Layout

### List Layout

```swift
private func createListLayout() -> UICollectionViewLayout {
    var config = UICollectionLayoutListConfiguration(appearance: .insetGrouped)
    config.headerMode = .supplementary
    return UICollectionViewCompositionalLayout.list(using: config)
}
```

### Grid Layout

```swift
private func createGridLayout() -> UICollectionViewLayout {
    let itemSize = NSCollectionLayoutSize(
        widthDimension: .fractionalWidth(0.5),
        heightDimension: .fractionalHeight(1.0)
    )
    let item = NSCollectionLayoutItem(layoutSize: itemSize)
    item.contentInsets = NSDirectionalEdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8)

    let groupSize = NSCollectionLayoutSize(
        widthDimension: .fractionalWidth(1.0),
        heightDimension: .fractionalWidth(0.5)
    )
    let group = NSCollectionLayoutGroup.horizontal(layoutSize: groupSize, subitems: [item])

    let section = NSCollectionLayoutSection(group: group)
    return UICollectionViewCompositionalLayout(section: section)
}
```

### Orthogonal Scrolling (Horizontal in Vertical)

```swift
private func createCarouselLayout() -> UICollectionViewLayout {
    let itemSize = NSCollectionLayoutSize(
        widthDimension: .fractionalWidth(0.8),
        heightDimension: .fractionalHeight(1.0)
    )
    let item = NSCollectionLayoutItem(layoutSize: itemSize)

    let groupSize = NSCollectionLayoutSize(
        widthDimension: .fractionalWidth(0.85),
        heightDimension: .absolute(200)
    )
    let group = NSCollectionLayoutGroup.horizontal(layoutSize: groupSize, subitems: [item])

    let section = NSCollectionLayoutSection(group: group)
    section.orthogonalScrollingBehavior = .groupPagingCentered
    section.interGroupSpacing = 10

    return UICollectionViewCompositionalLayout(section: section)
}
```

## Diffable Data Source

```swift
enum Section: Hashable {
    case main
    case featured
}

struct Item: Hashable {
    let id: UUID
    let title: String
}

private func configureDataSource() {
    dataSource = UICollectionViewDiffableDataSource<Section, Item>(collectionView: collectionView) {
        collectionView, indexPath, item in
        let cell = collectionView.dequeueReusableCell(withReuseIdentifier: MyCell.identifier, for: indexPath) as! MyCell
        cell.configure(with: item)
        return cell
    }
}

private func applySnapshot(items: [Item], animating: Bool = true) {
    var snapshot = NSDiffableDataSourceSnapshot<Section, Item>()
    snapshot.appendSections([.main])
    snapshot.appendItems(items, toSection: .main)
    dataSource.apply(snapshot, animatingDifferences: animating)
}
```

## Cell Registration (iOS 14+)

```swift
private let cellRegistration = UICollectionView.CellRegistration<MyCell, Item> { cell, indexPath, item in
    cell.configure(with: item)
}

// In data source
dataSource = UICollectionViewDiffableDataSource<Section, Item>(collectionView: collectionView) {
    collectionView, indexPath, item in
    collectionView.dequeueConfiguredReusableCell(using: self.cellRegistration, for: indexPath, item: item)
}
```

## Selection Handling

```swift
collectionView.delegate = self

func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
    guard let item = dataSource.itemIdentifier(for: indexPath) else { return }
    // Handle selection
}
```

## Performance Tips

| Issue | Solution |
|-------|----------|
| Memory pressure | Use cell prefetching |
| Slow layout | Cache layout calculations |
| Jerky scrolling | Pre-size images |
| Many sections | Use section snapshots |
