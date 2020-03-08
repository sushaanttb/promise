'use strict';

class TestPromise{

    status='PENDING';
    value;
    reason;

    onResolveCallbacks = new Array();
    onRejectCallbacks = new Array();
    registeredPromises = new Array();

    //where f is a function with 2 args : resolve/reject
    //def. of how resolve/reject works will be provided from client

    //ToDo:: need to check the further syntax of defining it.
    constructor(f){}

    //ToDo:: to make it private so that it can't be called directly
    resolve(val){
      //if the promise is already resolved/rejected & we have the corresponding value & reason also set
      //ignore this invocation
      if( (this.status=='RESOLVED' && this.value) || (this.status=='REJECTED' && this.reason)) return;
      
      if (this===val) throw TypeError; //(From the Spec)

      //else set the status and value accordingly & continue for it's own reg. callbacks
      this.status='RESOLVED';
      this.value = val;

      for(let i=0; i<onResolveCallbacks.length(); i++){
          
          let currentResolveCallback = onResolveCallbacks[i];
          let correspondingPromise = registeredPromises[i];
          
          if(!currentResolveCallback || typeof currentResolveCallback != 'function') {
            correspondingPromise(val,null);// <-- resolve the corresponding promise with the value directly
            return;
          };
          
          try{
            
            //ToDo:: to wait until execution stack is empty!!
            //Invoke the callback with the val param received
            
            let result = currentResolveCallback(val);
           
            if(result instanceof TestPromise){ // i.e. a promise itself

                // From the Spec: adopt it's state
                // But in reality, the only function we can call is then() on it!
                // so, we attach our registered task as a callback to it's then method once that completes
                
                // this is DIFFERENT from our understadning till now i.e. even if our rejectCallback gets called successfully
               // we still resolve the promise, but in this scenario, we are rejecting it!
               // ToDo:: Thus, is the syntax correct? because our then model is based on different understanding
               // or should it be like result.then((v) => correspondingPromise(v,null),null).then(null,(r) => correspondingPromise(null,r)) ???
               result.then((v) => correspondingPromise(v,null),
                            (r) => correspondingPromise(null,r));
            } 

            else if(typeof result == 'object'){ // an object or a 'thenable'
                //if result has property then
                if(result.hasOwnProperty('then')){
                    let thenProperty = result.then;

                    if(typeof thenProperty == 'function'){
                       // Q: to call it with it's this==result
                       // Q: to call it with 1st arg: resolvePromise & 2nd arg: rejectPromise ?
                       // i.e. then(resolvePromise, rejectPromise)
                       // such that if resolvePromise is called with value y, we resolve the corresponding promise with value y
                       // if rejectPromise is called with reason r, we reject the promise with r
                       
                       let invocationCnt = 0;
                       const resolvePromise = (y) => {
                         if(invocationCnt++ > 0) return; //oncifying attempt using closure : NEEDS to be tested.
                         correspondingPromise(y,null);
                       }

                       // this is DIFFERENT from our understadning till now i.e. even if our rejectCallback gets called successfully
                       // we still resolve the promise, but in this scenario, we are rejecting it!
                       const rejectPromise = (r) => {
                         if(invocationCnt++ > 0) return;
                         correspondingPromise(null,r);
                       }

                       //Q: how to ignore multiple calls to them?  inside them?
                       //A::oncify them using closures?

                       correspondingPromise(thenProperty(resolvePromise,rejectPromise),null);// this will call resolve method for this promise
                       // and it will resolve it acc. on same basis i.e. if it's a simple value, another promise or thenable
                    
                    }
                    else correspondingPromise(result,null);
                }
                // **** OUT OF SPEC  but again a valid case! ****
                else correspondingPromise(result,null);
            }
            // if it's a simple value, pass the value directly for it to resolve with that
            else correspondingPromise(result,null);
           
          }catch(error){
            correspondingPromise(null,error);
          }finally{
             //cleanup of all registered callbacks and promises
             this.onResolveCallbacks.shift();
             this.registeredPromises.shift();
          }
      }

    }

    //ToDo:: to make it private so that it can't be called directly
    reject(rsn){
       //if the promise is already resolved/rejected & we have the corresponding value & reason also set
      //ignore this invocation
      if((this.status=='RESOLVED' && this.value) || (this.status=='REJECTED' && this.reason)) return;
      
      //else set the status and reason accordingly & continue for it's own reg. callbacks
      this.status='REJECTED';
      this.reason = rsn;

      for(let i=0; i<this.onRejectCallbacks.length(); i++){
          
          let currentRejectCallback = this.onRejectCallbacks[i];
          let correspondingPromise = this.registeredPromises[i];
          
          if(!currentRejectCallback || typeof currentRejectCallback !='function') {
            correspondingPromise(null,rsn); // <-- reject the corresponding promise with reason directly
            return;
          };

          try{
            
            //ToDo:: to wait until execution stack is empty!!
            //Invoke the callback with the rsn param received

            let result = currentRejectCallback(rsn);
            //Q: can rejection result further be a Promise or thenable?
            //A: Although doesn't sounds much apt, but even if it is, it will get resolved using the Promise resolution procedure
            //as we are resolving the promise even if our rejection callback executed successfully.

            correspondingPromise(result,null);
           
          }catch(error){
            correspondingPromise(null,error);
          }finally{
             
             //cleanup of registered callbacks and promises
             this.onRejectCallbacks.shift(); // or splice(1,i)??
             this.registeredPromises.shift();
          }
      }
    }

    then(onResolve, onReject){
  
      if(onResolve && typeof onResolve == 'function') this.onResolveCallbacks.push(onResolve);
      else this.onResolveCallbacks.push(null); // to keep the array's indexes in sync esp w.r.t promises array

      if(onReject && typeof onReject == 'function') this.onRejectCallbacks.push(onReject);
      else this.onRejectCallbacks.push(null);

      // Where the Magic happens!
      //It's created as a function, so that it can be invoked ON-DEMAND with the values
      const newPromise = (res,rej) => new TestPromise(function(resolve,reject){
          if(res) resolve(res);
          else reject(rej);
      })
      this.registeredPromises.push(newPromise);

      //i.e. our promise has already resolved/rejected & we can entertain it immediately
      //based on our value/reason   
      if(status!='PENDING') {
            
        try{
            //ToDo:: to call onResolve/onReject only when execution call stack contains platform code
            //Approach : By submitting it in microtask queue?

            //ToDo: onResolve/onReject must be called as functions without 'this'
            //Approach : using strict as first line? also what about the this I'm using here for the sake of clarity?

            let x;

            if(this.value) {
              if(!onResolve || typeof onResolve == 'function') x = onResolve(this.value);
              else x= this.value;
              
              newPromise(x,null); // <-- this will run it's own resolve() aka 'promise resolution procedure' afterwards
            }
            else {
              if(!onReject || typeof onReject == 'function') {
                x = onReject(this.reason);
                //if our original promise got rejected and our 'onReject' callback provided was a valid callback
                //we resolve the new promise.
                newPromise(x,null);
              }else{
                //if our original promise got rejected and our 'onReject' callback provided as argument was invalid
                //we reject the new promise.
                newPromise(null,this.reason);
              }
           }
            // It's like saying to the root promise: "hey, these are my onResolve/OnReject callbacks in case you 
            // happen to get resolve or reject & any of my callback gets executed, I'm resolved" 

        }catch(error){
          //no point of doing onReject(error) again, simply pass the error so that it get's rejected accordingly.
          newPromise(null,error);
        
        }finally{
          //cleanup the latest added array elements
          this.onResolveCallbacks.pop();
          this.onRejectCallbacks.pop();
          this.registeredPromises.pop();
        }
      }

    return newPromise;
  }

  //Test suite Adapter requirements
  resolved(value){
    return new TestPromise((resolve,reject) => resolve(value));
  }

  rejected(reason){
    return new TestPromise((resolve,reject) => reject(reason));
  }

  deferred(){
    const newPromise = (res,rej) => new TestPromise(function(resolve,reject){
        if(res) resolve(res);
        else reject(rej);
    });
    
    return {
        'promise': newPromise,
        'resolve': this.resolve(this.value),
        'reject': this.reject(this.reason)
    }
  }
}