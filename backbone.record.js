// backbone.record

(function (Backbone) {

  "use strict";

  var api = {
    initialize: function () {},

    save: function (record, options) {
      var promise, sql;
      var self = this;

      options || (options = {});
      record = this._filter(record);
      promise = new Promise(options.ctx || this);
      sql = (record._id) ? this._update(record) : this._insert(record);

      this.db.transaction(function (tx) {
        tx.executeSql(sql, _(record).values(), function (tx, results) {
          record._id = results.insertId;
          self.trigger('save', record);
          promise.resolve(record);
        });
      }, error);

      return promise;
    },

    batch: function (rows, options) {
      var column, isArray, keys, promise, values, columns;
      var self = this;
      var sql = 'INSERT INTO ' + this.name;

      options || (options = {});

      if (!rows) return;

      values = "";
      columns = "";
      promise = new Promise(options.ctx || this);
      isArray = _(rows[0]).isArray();
      keys = (isArray) ? _(this.columns).keys() : _(rows[0]).keys();

      _(keys).each(function (column) {
        if (column != '_id' && this.columns[column]) {
          columns += (columns) ? ', ' + column : column;
          values += (values) ? ', ?' : '?';
        }
      }, this);

      sql += '(' + columns + ') VALUES ' + '(' + values + ')';

      this.db.transaction(function (tx) {
        _(rows).each(function (row) {
          tx.executeSql(sql, (isArray) ? row : _(row).values());
        });
      }, error, function () {
        self.trigger('batch', rows);
        promise.resolve(rows);
      });

      return promise;
    },

    find: function (criteria, options) {
      var record, i, l, column, promise, sql;
      var self = this;
      var values = [];
      var records = [];
      var conditions = '';

      options || (options = {});

      promise = new Promise(options.ctx || this);
      sql = this._queryStart(options);

      if (criteria) {
        sql += ' WHERE ';
        for (column in criteria) {
          if (_.isArray(criteria[column])) {
            sql += column + ' ' + criteria[column][0] + ' ? ';
            values.push(criteria[column][1]);
          }
          else {
            conditions += (conditions) ? ' AND ' + column + ' = ? ' : column + ' = ? '
            values.push(criteria[column]);
          }
        }
      }

      sql += conditions;
      sql = this._queryEnd(sql, options);

      this.db.readTransaction(function (t) {
        t.executeSql(sql, values, function (err, result) {
          if (result.rows.length != 0) {
            for (i = 0, l = result.rows.length; i < l; i++) {
              record = result.rows.item(i);
              records.push(record);
            }
          }

          promise.resolve(records);

          if (!options.silent) {
            self.trigger('found', records);
          }

        }, error);
      }, error);

      return promise;
    },

    notFound: function (criteria, options) {
      var promise, method;

      options || (options = {});
      criteria = this._filter(criteria);
      promise = new Promise(options.ctx || this);

      this.find(criteria, { silent: true }).then(function (results) {
        method = (!results.length) ? 'resolve' : 'reject';
        promise[method](results);
      });

      return promise;
    },

    found: function (criteria, options) {
      var promise, method;

      options || (options = {});
      criteria = this._filter(criteria);
      promise = new Promise(options.ctx || this);

      this.find(criteria, { silent: true }).then(function (results) {
        method = (results.length) ? 'resolve' : 'reject';
        promise[method](results);
      });

      return promise;
    },

    all: function (options) {
      var promise, record, i, l, column, sql
      var self = this;
      var values = [];
      var records = [];

      options || (options = {});
      sql = this._queryStart(options);
      promise = new Promise(options.ctx || this);
      sql = this._queryEnd(sql, options);

      this.db.readTransaction(function (t) {
        t.executeSql(sql, values, function (err, result) {
          if (result.rows.length != 0) {
            for (i = 0, l = result.rows.length; i < l; i++) {
              record = result.rows.item(i);
              records.push(record);
            }
          }

          self.trigger('all', records);
          promise.resolve(records);
        }, error);
      });

      return promise;
    },

    get: function (id, options) {
      var item, promise;
      var self = this;
      var sql = "SELECT * FROM " + this.name + ' WHERE _id = ' + id;

      options || (options = {});
      promise = new Promise(options.ctx || this);

      this.db.readTransaction(function (t) {
        t.executeSql(sql, [], function (err, result) {
          item = result.rows.item(0);
          self.trigger('get', item);
          promise.resolve(item);
        }, error);
      });

      return promise;
    },

    removeAll: function (options) {
      var promise;
      var self = this;
      var sql = "DELETE FROM " + this.name;
      var seqSql = "DELETE FROM sqlite_sequence WHERE name='" + this.name + "'";

      options || (options = {});
      promise = new Promise(options.ctx || this);

      this.db.transaction(function (t) {
        t.executeSql(sql, []);
        t.executeSql(seqSql, [], function () {
          self.trigger('removed', []);
          promise.resolve();
        }, error);
      });

      return promise;
    },

    remove: function (record, options) {
      var promise, id;
      var self = this;
      var sql = 'DELETE FROM ' + this.name + ' WHERE _id = ?';

      if (!record) { return; }

      options || (options = {});
      promise = new Promise(options.ctx || this);

      id = (record.id) ? record.id : record;

      this.db.transaction(function (t) {
        t.executeSql(sql, [id], function () {
          self.trigger('removed', [id]);
          promise.resolve();
        }, error);
      });

      return promise;
    },

    count: function (options) {
      var promise, size, sql;
      var self = this;

      options || (options = {});
      promise = new Promise(options.ctx || this);
      sql = "SELECT count(*) as rowsize FROM " + this.name;

      this.db.readTransaction(function (t) {
        t.executeSql(sql, [], function (err, result) {
          size = result.rows.item(0).rowsize;
          self.trigger('count', size);
          promise.resolve(size);
        }, error);
      });

      return promise;
    },

    drop: function (options) {
      var promise, sql;

      options || (options = {});
      promise = new Promise(options.ctx || this);
      sql = "DROP table " + this.name;

      this.db.transaction(function (t) {
        t.executeSql(sql, []);
        this.trigger('count', size);
        promise.resolve(size);
      });

      return promise;
    },

    // private

    _insert: function (record) {
      var values = '';
      var columns = '';
      var sql = 'INSERT INTO ' + this.name;

      _(record).each(function (value, column) {
        columns += (columns) ? ', ' + column : column;
        values += (values) ? ', ?' : '?';
      });

      sql += '(' + columns + ') VALUES ' + '(' + values + ')';

      return sql;
    },

    _queryStart: function (options) {
      var columns, distinct;

      options || (options = {});

      columns = (options.columns) ? options.columns :'*';
      distinct = (options.distinct) ? 'DISTINCT ' : '';

      return 'SELECT ' + distinct + columns + ' FROM ' + this.name;
    },

    _queryEnd: function (sql, options) {
      options || (options = {});

      if (options.limit) {
        sql += ' LIMIT ' + options.limit;
        if (options.offset) {
          sql += ' OFFSET ' + options.offset;
        }
      }

      return sql;
    },

    _update: function (record) {
      var columns = '';
      var sql = 'UPDATE ' + this.name + ' SET ';

      _(record).each(function (value, column) {
        columns += (columns) ? ', ' + column + ' = ?' : column + ' = ?';
      });

      sql += columns + ' WHERE _id = ' + record._id;

      return sql;
    },

    _create: function () {
      var column, sql;
      var keys = '';
      var self = this;
      var create = 'CREATE TABLE IF NOT EXISTS ' + this.name +
        '(_id INTEGER PRIMARY KEY AUTOINCREMENT';

      for (column in this.columns) {
        keys += ', ' + column + ' ' + this.columns[column];
      }

      create += keys + ')';

      this.db.transaction(function (tx) {
        tx.executeSql(create, [], function () {}, error);
        if (self.indices) {
          _(self.indices).each(function (column) {
            sql = "CREATE INDEX IF NOT EXISTS '" + column + "_index' ON '" +
              self.name + "' ('" + column + "' ASC)";
            tx.executeSql(sql, [], function () {}, error);
          });
        }
      });
    },

    _open: function () {
      this.db = openDatabase(this.name, "1", this.name, this.size);
    },

    _filter: function (data) {
      return _.reduce(data, function (memo, value, key) {
        if (this.columns[key]) {
          memo[key] = value;
        }
        return memo;
      }, {}, this);
    }
  };

  // helpers

  function error(tx, e) {
    throw new Error(e.message);
  }

  // Record constructor
  var Record = function (options) {
    if (!this.name || !this.columns) {
      throw new Error('database name or columns not defined');
    }

    options || (options = {});

    this.size = options.size || this.size || 5 * 1024 * 1024;
    this.initialize.apply(this, arguments);
    this._open();
    this._create();
  }

  _.extend(Record.prototype, Backbone.Events, api);
  Record.extend = Backbone.Model.extend;
  Backbone.Record = Record;

  // simple promise implementation
  function Promise(context) {
    this.context = context || this;
    this.success = [];
    this.error = [];
  }

  Promise.prototype = {
    constructor: Promise,

    then: function (success, error) {
      if (success) {
        if (this.resolved) {
          success.apply(this.context, this.resolved);
        }
        else {
          this.success.push(success);
        }
      }

      if (error) {
        if (this.rejected) {
          error.apply(this.context, this.rejected);
        }
        else {
          this.error.push(error);
        }
      }

      return this;
    },

    resolve: function () {
      var callback;

      this.resolved = arguments;
      this.error = [];

      while (callback = this.success.shift()) {
        callback.apply(this.context, this.resolved);
      }
    },

    reject: function () {
      var callback;

      this.rejected = arguments;
      this.success = [];

      while (callback = this.error.shift()) {
        callback.apply(this.context, this.rejected);
      }
    }
  };

})(Backbone);
