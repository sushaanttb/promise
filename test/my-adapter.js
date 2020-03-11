const TestPromise = require ('../src/testPromise.js');


//Test suite Adapter requirements(currently based on assumption,will be verified during tests)
 exports.resolved = function(value){
    return new TestPromise((resolve,reject) => resolve(value));
  }

 exports.rejected = function(reason){
    return new TestPromise((resolve,reject) => reject(reason));
  }

 exports.deferred = function(){
    const newPromise = (res,rej) => new TestPromise(function(resolve,reject){
        if(res) resolve(res);
        else reject(rej);
    });
    
    return {
        'promise': newPromise,
        'resolve': this.resolve,
        'reject': this.reject
    }
  }
