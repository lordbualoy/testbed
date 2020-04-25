Array.prototype.removeAt = function (index) {
    if (index >= 0)
        this.splice(index, 1);
};

Array.prototype.remove = function (predicate) {
    const index = this.data.findIndex(predicate);
    this.removeAt(index);
};
