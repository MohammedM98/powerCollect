/// Reading one field of a server answer, defensively: an amount may come as
/// a number or a decimal string, an optional field may be missing, and a
/// required one that is missing names itself in the error.
extension JsonFields on Map<String, dynamic> {
  Object _required(String field, String model) {
    final value = this[field];
    if (value == null) {
      throw FormatException('$model: the server left out "$field".');
    }
    return value;
  }

  int requiredInt(String field, String model) {
    final value = _required(field, model);
    final parsed = value is num ? value.toInt() : int.tryParse('$value');
    if (parsed == null) {
      throw FormatException('$model: "$field" is not a whole number.');
    }
    return parsed;
  }

  String requiredString(String field, String model) =>
      '${_required(field, model)}';

  String? optionalString(String field) {
    final value = this[field];
    return value == null ? null : '$value';
  }

  double? optionalNumber(String field) =>
      this[field] == null ? null : double.tryParse('${this[field]}');
}
