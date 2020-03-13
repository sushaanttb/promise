"use strict";

module.exports = class TestPromise{

    status='PENDING'; //PENDING,FULFILLED,REJECTED
    value;
    reason;

    deferreds = new Array();
    onFulfilledCallbacks = new Array();
    onRejectedCallbacks = new Array();
    registeredPromises = new Array();

    //where f is a function with 2 args : resolve/reject
    //def. of how resolve/reject works will be provided from client
    //ToDo:: need to confirm the syntax here,should be inline & also the constructor body if reqd.
    constructor(resolver){
      // if(!resolver || typeof resolver == 'function') throw TypeError("Promise resolver is not a function!");
    }

    //ToDo:: to make it private
    resolve(val){

      if (this.status=='FULFILLED') return;
      if (val===this) return reject(TypeError); //(From the Spec,2.3.1)

      genericDeduce(val,'fulfill');
      
      //since this.value can be undefined
      if(this.status=='FULFILLED') resolveCallbacks();

    }

    //ToDo:: to make it private
    reject(rsn){
      if(this.status=='REJECTED') return;
      if (rsn===this) return reject(TypeError); //(From the Spec ,2.3.1)
      
      // this.status = 'REJECTED';
      // this.reason = rsn; //Q: do we need same promise/thenable checks? A: yes

      genericDeduce(rsn,'reject');
      
      //since this.reason can be undefined
      if(this.status=='REJECTED') resolveCallbacks();
      
    }

    genericDeduce(x,resolutionType){
        //From spec 2.3, as per promise resolution procedure 
        try{
                if(x instanceof TestPromise) x.then((v)=>resolve(v), (r) => reject(r)); //<-- adopting it's state

                else if(typeof x == 'object'){

                     if(x.hasOwnProperty('then')){
                        let thenProperty = x.then;

                        if(typeof thenProperty == 'function'){
                            //ToDo: to call it with this=x
                            //A: Although I believe it should be fine since by def. of it ,it is already val.then 

                           let invocationCnt = 0;
                           const resolvePromise = (y) => {
                             if(invocationCnt++ >0) return; //oncifying attempt using closure : NEEDS to be tested.    
                                 try{
                                   resolve(y,null); // <-- fulfill
                                 }catch(error){
                                   reject(null,error); // <-- reject with error
                                 }
                            }
                           const rejectPromise = (r) => {
                             if(invocationCnt++ >0) return; //oncifying attempt using closure : NEEDS to be tested.
                               try{
                                   reject(null,r); // <-- reject with reason
                               }catch(error){
                                   reject(null,error); // <-- reject with error
                               }
                            }
                            // TODO: when resolvePromise & rejectPromise are called at same time,ignored 2nd invocation
                           // A: although I believe the above oncify attempt & also the status checks in resolve/reject should do the
                           // trick, still there can be a race condition and it would be great if they can work on a common
                           // invocationCnt variable.
                           
                            thenProperty(resolvePromise,rejectPromise);// <-- calling then function with the above created oncified functions
                            
                        }else{ // i.e. if it has a then property but it is not a function
                          updatePromiseStatus(x,resolutionType);
                        }
                     }else{// **** OUT OF SPEC  but a valid case if it has no then property! ****
                       updatePromiseStatus(x,resolutionType);
                     }       
                }
                else{
                  updatePromiseStatus(x,resolutionType);     
                }
        }catch(error){
            reject(null,error);
        }
    }

    updatePromiseStatus(x,resolutionType){
      
      if(this.status=='FULFILLED' || this.status=='REJECTED') return;
        
      if(resolutionType=='fulfill'){
         this.status='FULFILLED';
         this.value = x;
      }else{
         this.status='REJECTED';
         this.reason = x;
      }
    }

    resolveCallbacks(){
         for(let i=0; i<this.deferreds.length(); i++){
        
              // let correspondingPromise = registeredPromises[i];
              let deferred = this.deferreds[i];
              let currentFulfillCallback = onFulfilledCallbacks[i];
              let currentRejectCallback = onRejectedCallbacks[i];
           
              try{
                
                    if(this.status=='FULFILLED' && (!currentFulfillCallback || typeof currentFulfillCallback != 'function')) {
                          deferred.resolve(this.value);// <-- fulfill the corresponding promise with the value directly(2.2.7.3)
                    }else if(this.status=='REJECTED' && (!currentRejectCallback || typeof currentRejectCallback !='function')) {
                          deferred.reject(this.reason); // <-- reject the corresponding promise with reason directly(2.2.7.4)
                    }else{
                      //ToDo:: When invoking any callback: to wait until execution stack is empty!!
                      //Approach : by submitting it in using microtaskqueue?
                      let result;
                      this.status=='FULFILLED'? (result = currentFulfillCallback(this.value)) : (result = currentRejectCallback(this.reason));
                      deferred.resolve(result);// <-- fulfill the corresponding promise based on it's callback value since callback executed successfully
                   }
              }catch(error){
                deferred.reject(error);// <-- reject if any error
              }finally{
                //cleanup of all registered callbacks and promises irrespective of it was fulfilled/rejected
                this.deferreds.shift();
                this.onFulfilledCallbacks.shift();
                this.onRejectedCallbacks.shift();
                this.registeredPromises.shift();
              }
           }
    }
    
    then(onFulfilled, onRejected){
    
      if(onFulfilled && typeof onFulfilled == 'function') this.onFulfilledCallbacks.push(onFulfilled);
      else this.onFulfilledCallbacks.push(null); // to keep the array's indexes in sync esp w.r.t promises array

      if(onRejected && typeof onRejected == 'function') this.onRejectedCallbacks.push(onRejected);
      else this.onRejectedCallbacks.push(null);

      // // Where the Magic happens: It's created as a function, so that it can be invoked ON-DEMAND with the values
      // const newPromise = (res,rej) => new TestPromise(function(resolve,reject){
      //     if(res) resolve(res);
      //     else reject(rej);
      // })

      const newPromise = new TestPromise(function(resolve,reject){
        
        let d = {
          'resolve': resolve,
          'reject' : reject
        }
        deferreds.push(d);

      });

      this.registeredPromises.push(newPromise);

      if(this.status!='PENDING') {
            //ToDo:: to call onFulfilled/onRejected only when execution call stack contains platform code
            //Approach : By submitting it in microtask queue?

            //ToDo: onFulfilled/onRejected must be called as functions without 'this'
            //Approach : using strict as first line? also what about the this I'm using here for the sake of clarity?

        //From 2.2.7.1 :: If either onFulfilled or onRejected returns a value x, run the Promise Resolution Procedure [[Resolve]](promise2, x)           
        try{
            let d = this.deferreds[this.deferreds.length()-1];
            let x;

            if(status=='FULFILLED') { //since value can be undefined
              if(!onFulfilled || typeof onFulfilled == 'function') x = onFulfilled(this.value);
              else x= this.value;
              
              d.resolve(x); // <-- this will run resolve() of newPromise
            }
            else {
              if(!onRejected || typeof onRejected == 'function') {
                x = onRejected(this.reason);
                
                //From 2.2.7.1:: i.e if our root promise got rejected and the 'onRejected' callback was valid callback
                // we resolve the new promise.
                d.resolve(x);// <-- this will run resolve() of newPromise
              }else{
                //if our root promise got rejected and our 'onRejected' callback provided was invalid
                //we reject the new promise.
                d.reject(this.reason);
              }
           }
          

        }catch(error){
          d.reject(error);
        }finally{
          this.deferreds.pop();
          this.onFulfilledCallbacks.pop();
          this.onRejectedCallbacks.pop();
          this.registeredPromises.pop();
        }
      }

      return newPromise;
  }

}

