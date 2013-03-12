## Backbone.Record

WIP...


## Description

**Backbone.Record** is a way to interact with WebSQL via simple API from you Backbone app.

WebSQL is not hot anymore but I needed something which works in a mobile environment and [indexDB](http://caniuse.com/indexeddb) is not there yet...


### Current API

+ save(record, options)

+ batch(array, options)

+ find(criteria, options)

+ all(options)

+ get(id, options)

+ remove(id | record)

+ count(options)

+ drop(options)


### Example usage

```js

var User = Backbone.Record.extend({
  name: 'users',
  size: 4 * 1024 * 1024, // 4 MB
  columns: {
    email: 'NVARCHAR(100)',
    name: 'NVARCHAR(100)',
    passowrd: 'NVARCHAR(10)'
    ...
  }
});

```

##License:
<pre>
The MIT License
</pre>
