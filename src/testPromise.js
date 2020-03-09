'use strict';

class TestPromise{

    status='PENDING'; //PENDING,FULFILLED,REJECTED
    value;
    reason;

    onFulfilledCallbacks = new Array();
    onRejectedCallbacks = new Array();
    registeredPromises = new Array();

    //where f is a function with 2 args : resolve/reject
    //def. of how resolve/reject works will be provided from client
    //ToDo:: need to confirm the syntax here,should be inline & also the constructor body if reqd.
    constructor(f){}

    //ToDo:: to make it private
    resolve(val){
      if( (this.status=='FULFILLED' && this.value) || (this.status=='REJECTED' && this.reason)) return;
      if (val===this) return reject(TypeError); //(From the Spec,2.3.1)

      this.status='FULFILLED';
      this.value = val;

      for(let i=0; i<onFulfilledCallbacks.length(); i++){
          
          let currentFulfillCallback = onFulfilledCallbacks[i];
          let correspondingPromise = registeredPromises[i];
          
          if(!currentFulfillCallback || typeof currentFulfillCallback != 'function') {
            correspondingPromise(val,null);// <-- fulfill the corresponding promise with the value directly
            continue;
          };
          
          try{
            
            //ToDo:: to wait until execution stack is empty!!
            //Approach : by submitting it in using microtaskqueue?
            
            let result = currentFulfillCallback(val);
           
            if(result instanceof TestPromise){

                /* From the Spec: adopt it's state
                 But in reality, the only function we can call on any promise is then() only
                 so, we attach our registered task as a callback to it's then method once that completes
                */

                /* From 2.3.2.2. && 2.3.2.3 i.e 
                  If/when x is fulfilled, fulfill promise with the same value.
                  If/when x is rejected, reject promise with the same reason.
               
                // Major ToDo:: this is DIFFERENT from our understanding from the then model till now (Spec 2.2.7.1) i.e. even if our rejectedCallback gets called successfully
                // we still resolve the promise, but in this scenario, we are rejecting it!
               
                */

               result.then((v) => correspondingPromise(v,null),
                            (r) => correspondingPromise(null,r));
            } 

            else if(typeof result == 'object'){ // an object or a 'thenable'
                //if result has property then
                if(result.hasOwnProperty('then')){
                    let thenProperty = result.then;

                    if(typeof thenProperty == 'function'){
                       /* ToDo: to call it with it's this=result,although I believe it should be fine since by def. of it ,it is result.then 
                        to call it with 1st arg: resolvePromise & 2nd arg: rejectPromise
                        i.e. then(resolvePromise, rejectPromise)
                        such that if resolvePromise is called with value y, we resolve the corresponding promise with value y
                        if rejectPromise is called with reason r, we reject the promise with r
                       */
                       
                       let invocationCnt = 0;
                       const resolvePromise = (y) => {
                         if(invocationCnt++ > 0) return; //oncifying attempt using closure : NEEDS to be tested.
                         
                           try{
                              correspondingPromise(y,null);
                           }catch(error){
                             correspondingPromise(null,error); // <-- reject with error
                           }
                        }

                       //Major ToDo :: this is DIFFERENT from our understanding till now (Spec 2.2.7.1) i.e. even if our rejectCallback gets called successfully
                       // we still resolve the promise, but in this scenario, we are rejecting it!

                       const rejectPromise = (r) => {
                         if(invocationCnt++ > 0) return;
                         
                           try{
                               correspondingPromise(null,r); // <-- reject with reason
                           }catch(error){
                               correspondingPromise(null,error); // <-- reject with error
                           }
                        }

                       //ToDo: To ignore multiple calls to them?  inside them?
                       //A: done, oncify them using closures

                       //ToDo : To ignore when calling thenproperty throws ex and if resolvePromise/rejectPromise have already been called
                       //A: done

                       thenProperty(resolvePromise,rejectPromise);
                    }
                    else correspondingPromise(result,null);
                }
                // **** OUT OF SPEC  but a valid case if it has no then property! ****
                else correspondingPromise(result,null);
            }
            // if it's a simple value, pass the value directly for it to resolve with that
            else correspondingPromise(result,null);
           
          }catch(error){
            correspondingPromise(null,error);
          }finally{
             //cleanup of all registered callbacks and promises
             this.onFulfilledCallbacks.shift();
             this.registeredPromises.shift();
          }
      }

    }

    //ToDo:: to make it private
    reject(rsn){
      if((this.status=='FULFILLED' && this.value) || (this.status=='REJECTED' && this.reason)) return;
      if (rsn===this) return reject(TypeError); //(From the Spec ,2.3.1)
      
      this.status='REJECTED';
      this.reason = rsn;

      for(let i=0; i<this.onRejectedCallbacks.length(); i++){
          
          let currentRejectCallback = this.onRejectedCallbacks[i];
          let correspondingPromise = this.registeredPromises[i];
          
          if(!currentRejectCallback || typeof currentRejectCallback !='function') {
            correspondingPromise(null,rsn); // <-- reject the corresponding promise with reason directly
            continue;
          };

          try{
            
            //ToDo:: to wait until execution stack is empty!!
            //Approach : by submitting it in using microtaskqueue?

            //Invoke the callback with the rsn param received
            let result = currentRejectCallback(rsn);
            
            //Q: can rejection result further be a Promise or thenable?
            //A: Although doesn't sounds much apt, but even if it is, it will get resolved using the Promise resolution procedure
            //as we are resolving the promise even if our rejection callback executed successfull

            /* Major ToDo :: Currently this is coded as per understanding from then model of Spec 2.2.7.1 
            //To check in this again, i.e. if it should be otherwise like correspondingPromise(null,result);
            // & if above is the case then how it will handle if result is a promise or thenable?
            */
            correspondingPromise(result,null);
           
          }catch(error){
            correspondingPromise(null,error);
          }finally{
             //cleanup of registered callbacks and promises
             this.onRejectedCallbacks.shift(); // or splice(1,i)??
             this.registeredPromises.shift();
          }
      }
    }

    then(onFulfilled, onRejected){
  
      if(onFulfilled && typeof onFulfilled == 'function') this.onFulfilledCallbacks.push(onFulfilled);
      else this.onFulfilledCallbacks.push(null); // to keep the array's indexes in sync esp w.r.t promises array

      if(onRejected && typeof onRejected == 'function') this.onRejectedCallbacks.push(onRejected);
      else this.onRejectedCallbacks.push(null);

      // Where the Magic happens: It's created as a function, so that it can be invoked ON-DEMAND with the values
      const newPromise = (res,rej) => new TestPromise(function(resolve,reject){
          if(res) resolve(res);
          else reject(rej);
      })
      this.registeredPromises.push(newPromise);

      // i.e. If our promise has already fulfilled/rejected & we can entertain it immediately
      // based on our value/reason   
      if(status!='PENDING') {
            
        try{
            //ToDo:: to call onFulfilled/onRejected only when execution call stack contains platform code
            //Approach : By submitting it in microtask queue?

            //ToDo: onFulfilled/onRejected must be called as functions without 'this'
            //Approach : using strict as first line? also what about the this I'm using here for the sake of clarity?

            //From 2.2.7.1 :: If either onFulfilled or onRejected returns a value x, run the Promise Resolution Procedure [[Resolve]](promise2, x)
            let x;

            if(this.value) {
              if(!onFulfilled || typeof onFulfilled == 'function') x = onFulfilled(this.value);
              else x= this.value;
              
              newPromise(x,null); // <-- this will run it's own resolve() i.e.'promise resolution procedure' accordingly
            }
            else {
              if(!onRejected || typeof onRejected == 'function') {
                x = onRejected(this.reason);
                
                //From 2.2.7.1:: thus, if our original promise got rejected and our 'onRejected' callback provided was a valid callback
                // we resolve the new promise.
                newPromise(x,null);// <-- this will run it's own resolve() i.e.'promise resolution procedure' accordingly
              }else{
                //if our original promise got rejected and our 'onRejected' callback provided as argument was invalid
                //we reject the new promise.
                newPromise(null,this.reason);
              }
           }
            /* Major ToDo::: From 2.2.7.1, It's like saying to the root promise: "hey, these are my onFulfilled/OnRejected callbacks in case you 
              happen to get fulfilled or rejected & any of my callback gets executed successfully, I'm fulfilled." 
            
              But!!!! : Based on 2.3.2.2 && 2.3.2.3: It's not same
              
              Is it that I am misuderstanding the Promise Resolution Procedure [[Resolve]](promise2, x) such that it actually doesn't means calling resolve()?
            */

        }catch(error){
          newPromise(null,error);
        }finally{
          //cleanup the latest added array elements
          this.onFulfilledCallbacks.pop();
          this.onRejectedCallbacks.pop();
          this.registeredPromises.pop();
        }
      }

    return newPromise;
  }

  //Test suite Adapter requirements(currently based on assumption,will be verified during tests)
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
        'resolve': this.resolve,
        'reject': this.reject
    }
  }
}
