Date.isLeapYear = function (year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
};

Date.getDaysInMonth = function (year, month) {
    return [31, Date.isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
};

Date.prototype.isLeapYear = function () {
    return Date.isLeapYear(this.getFullYear());
};

Date.prototype.getDaysInMonth = function () {
    return Date.getDaysInMonth(this.getFullYear(), this.getMonth());
};

Date.prototype.addMonths = function (value) {
    const n = this.getDate();
    this.setDate(1);
    this.setMonth(this.getMonth() + value);
    this.setDate(Math.min(n, this.getDaysInMonth()));
    return this;
};

Date.prototype.addYears = function (value) {
    const n = this.getFullYear();
    if (this.getMonth() === 1 && this.getDate() === 29 && Date.isLeapYear(n) && !Date.isLeapYear(n + value)) {
        this.setDate(28);
    }
    this.setFullYear(n + value);
    return this;
};

Date.prototype.calculatePeriodToGivenDate = function (target) {
    let before, after;
    if (target > this) {
        after = target;
        before = this;
    }
    else {
        after = this;
        before = target;
    }

    const d = new Date(before.getTime());
    const year = (function () {
        let y = after.getFullYear() - before.getFullYear();
        d.addYears(y);
        if (d > after) {
            d.addYears(-1);
            y--;
        }
        return y;
    })();

    const month = (function () {
        let m = 12 * (after.getFullYear() - d.getFullYear()) + after.getMonth() - d.getMonth();
        d.addMonths(m);
        if (d > after) {
            d.addMonths(-1);
            m--;
        }
        return m;
    })();

    const day = Math.trunc((after - d) / 86400000);

    return { years: year, months: month, days: day };
};

Date.prototype.formatDate = function () {
    let month = '' + (this.getMonth() + 1),
        day = '' + this.getDate(),
        year = this.getFullYear();

    if (month.length < 2)
        month = '0' + month;
    if (day.length < 2)
        day = '0' + day;

    return [year, month, day].join('-');
};
