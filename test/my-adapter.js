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
 
    var newPromise = new Promise((resolve,reject)=>{
      d.resolve = resolve;
      d.reject = reject;
    });
    
    d.promise = newPromise; 
    // console.log("From my-adapter.js, Printing keys of d::"+Object.keys(d));
    return d;
  }
