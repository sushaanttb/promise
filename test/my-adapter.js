const TestPromise = require ('../src/testPromise.js');


//Test suite Adapter requirements(currently based on assumption,will be verified during tests)
 exports.resolved = function(value){
    return new TestPromise((resolve,reject) => resolve(value));
  }

 exports.rejected = function(reason){
    return new TestPromise((resolve,reject) => reject(reason));
  }

 exports.deferred = function(){
    
    let d={};
  
    let done = (resolve,reject) => {
        d.resolve = resolve;
        d.reject = reject;
      }; 

    const newPromise = new TestPromise(function(resolve,reject){
        done(resolve,reject);
    });
    
    d.promise = newPromise; 
    return d;
  }
