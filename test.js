var redis = require('redis');
var Redlock = require('redlock');
var cluster = require('cluster');
var numCPUs = require('os').cpus().length;
var workers = [];

var resource = 'locks:datasetclient:myShoppingList';
var ttl = 100;
var start = Date.now();


if (cluster.isMaster) {
    for (var i = 0; i < numCPUs; i++) {
        var worker = cluster.fork();
        workers.push(worker);
    }

    // Handle workers exiting
    cluster.on('exit', function() {
        console.log('worker exit', arguments);
    });
    startMaster();
} else {
    startWorker();
}

function startMaster() {
  console.log('start master');
}

function startWorker() {
  console.log('start worker', cluster.worker.id);
  var client = redis.createClient();
  var redlock = new Redlock(
      // you should have one client for each redis node
      // in your cluster
      [client],
      {
          retryCount:  Infinity,
          retryDelay: 50
      }
  );
  setTimeout(function() {
    loop(redlock, 'a', cluster.worker.id);
    loop(redlock, 'b', cluster.worker.id);
    loop(redlock, 'c', cluster.worker.id);
    loop(redlock, 'd', cluster.worker.id);
    loop(redlock, 'e', cluster.worker.id);
  }, 0);
}

function loop(redlock, suffix, id) {
  redlock.lock(resource + suffix, 20000).then(function(lock) {
    console.log('!!!!!! got lock', suffix, 'for 20000', id, Date.now() - start);
    setTimeout(function() {
      console.log('!!!!! DONE', id, Date.now() - start);
      return lock.extend(ttl).then(function(lock){
        return loop(redlock, suffix, id);
      });
    }, ttl + 1000);
  }).catch(function(){
    console.error('error getting lock', cluster.worker.id, arguments);
    process.exit(1);
  });
}