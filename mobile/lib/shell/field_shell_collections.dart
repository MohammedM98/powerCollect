part of 'field_shell.dart';

/// The collections search and opening a subscriber's page.
extension _ShellCollections on _FieldShellState {
  Future<void> refreshCollections() async {
    final result = await widget.api.collectionsToday();
    if (mounted) {
      change(() => today = (result['data'] as List)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList());
    }
  }

  void collectionSearchChanged() {
    collectionDebounce?.cancel();
    collectionRequest++;
    // The current results stay on screen, dimmed, until the new ones arrive.
    change(() {
      collectionBusy = true;
      collectionError = null;
    });
    collectionDebounce = Timer(const Duration(milliseconds: 300),
        () => unawaited(searchCollections()));
  }

  Future<void> searchCollections({bool loadMore = false}) async {
    if (!canBrowseSubscribers ||
        !mounted ||
        section != FieldSection.collections) {
      return;
    }
    if (loadMore && (collectionBusy || collectionPage >= collectionLastPage)) {
      return;
    }
    collectionDebounce?.cancel();
    final request = ++collectionRequest;
    final query = collectionSearch.text.trim();
    final page = loadMore ? collectionPage + 1 : 1;
    change(() {
      collectionBusy = true;
      collectionError = null;
    });
    try {
      final result =
          await widget.api.findCollectionSubscribers(query, page: page);
      if (mounted && request == collectionRequest) {
        change(() {
          online = true;
          requiresLogin = false;
          final results = (result['data'] as List)
              .map((item) => Map<String, dynamic>.from(item as Map))
              .toList();
          collectionResults =
              loadMore ? [...collectionResults, ...results] : results;
          collectionPage = result['current_page'] as int? ?? page;
          collectionLastPage = result['last_page'] as int? ?? page;
        });
      }
    } on ApiException catch (error) {
      if (mounted && request == collectionRequest) {
        change(() {
          if (!loadMore) {
            collectionResults = [];
            collectionPage = 0;
          }
          if (error.isNetwork || error.statusCode == 401) online = false;
          if (error.statusCode == 401) requiresLogin = true;
          collectionError = error.message;
        });
      }
    } finally {
      if (mounted && request == collectionRequest) {
        change(() => collectionBusy = false);
      }
    }
  }

  Future<void> saveReadings(List<Map<String, dynamic>> readings) async {
    await widget.store.queueReadings(readings);
    if (!mounted) return;
    change(() => message = null);
  }

  /// Open the subscriber's page, where the payment is recorded from.
  Future<void> openSubscriber(Map<String, dynamic> subscriber) async {
    FocusScope.of(context).unfocus();
    if (!online) {
      showAppToast(context, 'عرض حساب المشترك يتطلب اتصالًا بالخادم.',
          icon: 'cloudoff');
      return;
    }
    final recorded = await Navigator.of(context).push<bool>(MaterialPageRoute(
      builder: (_) => SubscriberPage(
          api: widget.api,
          store: widget.store,
          subscriber: subscriber,
          paymentMethods: paymentMethods,
          exchangeRates: exchangeRatesFrom(currentUser['currencies']),
          transferBanks: currentUser['transfer_banks'] is List
              ? List<String>.from(currentUser['transfer_banks'] as List)
              : defaultTransferBanks,
          senderBanks: currentUser['sender_banks'] is List
              ? List<String>.from(currentUser['sender_banks'] as List)
              : const []),
    ));
    if (!mounted) return;
    // A submission sent from that page may have been settled or left unconfirmed.
    change(() {});
    if (section != FieldSection.collections) return;
    try {
      if (recorded == true && canCollect) await refreshCollections();
      if (mounted && recorded == true) await searchCollections();
    } on ApiException catch (error, stack) {
      unawaited(Diagnostics.record(error, stack, where: 'field_shell'));
      // The payment is already recorded; a failed refresh must not obscure it.
    }
  }
}
