const TestPromise = require ('../src/testPromise.js');


//Test suite Adapter requirements(currently based on assumption,will be verified during tests)
 exports.resolved = (value)=>{
    return new TestPromise((resolve,reject)=> resolve(value));
  }

 exports.rejected = (reason)=>{
    return new TestPromise((resolve,reject) => reject(reason));
  }

 exports.deferred = ()=>{

    let res = null,rej = null;
    let newPromise = new TestPromise((resolve,reject)=>{
        this.res = resolve;
        this.rej = reject;
        // console.log("In newPromise construct, resolve:"+resolve);
        // console.log("In newPromise construct, this.res:"+this.res);

    });
    // console.log("After newPromise construct, this.res:"+this.res);
    // console.log("After newPromise construct, res:"+res);

    return {
      'promise': newPromise,
      'resolve': this.res,
      'reject': this.rej
    };  
    
  }

