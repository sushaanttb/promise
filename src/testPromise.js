"use strict";

module.exports = class TestPromise{

    status='PENDING'; //PENDING,FULFILLED,REJECTED
    value;
    reason;

    deferreds = new Array();
    onFulfilledCallbacks = new Array();
    onRejectedCallbacks = new Array();
    registeredPromises = new Array();

  
    constructor(resolver){
      if(!resolver || typeof resolver != 'function') this.reject(new TypeError("Promise resolver is not a function!"));
      resolver(this.resolve, this.reject);
    }

    genericDeduce=(x,resolutionType)=>{
        //From spec 2.3, as per promise resolution procedure 
        try{
                // console.log("x:::"+JSON.stringify(x)+ ","+typeof(x));
                if(!x){ //console.log("In 1st ..."); 
                this.updatePromiseStatus(x,resolutionType); }
                else if(x instanceof TestPromise) x.then((v)=>this.resolve(v), (r) => this.reject(r)); //<-- adopting it's state
                else if(typeof x === 'object'){
                  // console.log("In 3rd ...");
                  // console.log(Object.getOwnPropertyNames(x));
                  
                    if(Object.prototype.hasOwnProperty.call(x, 'then')){
                        let thenProperty = x.then;

                        // console.log("In genericDeduce thenProperty:: "+thenProperty);
                  
                        if(typeof thenProperty === 'function'){
                            //ToDo: to call it with this=x
                            //A: Although I believe it should be fine since by def. of it ,it is already val.then 

                          let invocationCnt = 0;
                          const resolvePromise = (y) => {
                            
                            // console.log("In oncified resolvePromise,invocationCnt::"+invocationCnt);
                            if(invocationCnt++ >0) return; //oncifying attempt using closure : NEEDS to be tested.   
                            
                            // console.log("In oncified resolvePromise,invocationCnt::"+invocationCnt);
                                try{
                                  this.resolve(y); // <-- fulfill
                                }catch(error){
                                  this.reject(error); // <-- reject with error
                                }
                            }
                          const rejectPromise = (r) => {

                            if(invocationCnt++ >0) return; //oncifying attempt using closure : NEEDS to be tested.
                            // console.log("In oncified rejectPromise,invocationCnt::"+invocationCnt);

                              try{
                                 this.reject(r); // <-- reject with reason
                              }catch(error){
                                 this.reject(error); // <-- reject with error
                              }
                            }
                          // TODO: when resolvePromise & rejectPromise are called at same time,ignored 2nd invocation
                          // A: although I believe the above oncify attempt & also the status checks in resolve/reject should do the
                          // trick, still there can be a race condition and it would be great if they can work on a common
                          // invocationCnt variable.
                          
                          //handling 2.3.3.3.4: If calling `then` throws an exception `e`
                          try{
                            thenProperty.call(x,resolvePromise,rejectPromise);// <-- calling then function with the above created oncified functions
                          }catch(error){
                            //if in the then callback it already resolved once, we need to ignore if there was any error afterwards
                            if(this.status=='PENDING') this.reject(error);
                          }

                        }else{ // i.e. if it has a then property but it is not a function
                          this.updatePromiseStatus(x,resolutionType);
                        }
                    }else{// **** OUT OF SPEC  but a valid case if it has no then property! ****
                      this.updatePromiseStatus(x,resolutionType);
                    }       
                }
                else this.updatePromiseStatus(x,resolutionType);     
                
        }catch(error){
            this.reject(error);
        }
    }

    updatePromiseStatus=(x,resolutionType)=>{
      
      if(this.status=='FULFILLED' || this.status=='REJECTED') return;
        
      if(resolutionType==='fulfill'){
        this.status='FULFILLED';
        this.value = x;
      }else{
        this.status='REJECTED';
        this.reason = x;
      }

      // console.log("In updatePromiseStatus, (x,resolutionType):: ("+ JSON.stringify(x)+ ", "+resolutionType+")");
    }

    resolveCallbacks=()=>{
        for(let i=0; i<this.deferreds.length; i++){
        
              // let correspondingPromise = registeredPromises[i];
              let deferred = this.deferreds[i];
              let currentFulfillCallback = this.onFulfilledCallbacks[i];
              let currentRejectCallback = this.onRejectedCallbacks[i];
          
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

    //ToDo:: to make it private
    resolve=(val)=>{
      // console.log("In resolve, this::"+JSON.stringify(this));
      // console.log("resolve called with::"+val);
      
      if (this.status=='FULFILLED') return;
      if (val===this) return this.reject(new TypeError("resolution value can't be the same promise!")); //(From the Spec,2.3.1)

      this.genericDeduce(val,'fulfill');
      
      //since this.value can be undefined
      if(this.status=='FULFILLED') this.resolveCallbacks();

    }

    //ToDo:: to make it private
    reject=(rsn)=>{
      // console.log("In reject, this::"+JSON.stringify(this));
      // console.log("reject called with::"+JSON.stringify(rsn));

      if(this.status=='REJECTED') return;
      if (rsn===this) return this.reject(new TypeError("rejection reason can't be the same promise!")); //(From the Spec ,2.3.1)
      // console.log("In reject, is rsn typerror::"+ rsn instanceof TypeError);

      this.status = 'REJECTED';
      this.reason = rsn; //Q: do we need same promise/thenable checks? A: yes

      // this.genericDeduce(rsn,'reject');
      
      //since this.reason can be undefined
      if(this.status=='REJECTED') this.resolveCallbacks();
      
    }

    then=(onFulfilled, onRejected)=>{
    
      // console.log("onFulfilled::"+onFulfilled +"->"+ (onFulfilled && typeof onFulfilled === 'function'));
      // console.log("onRejected::"+onRejected +"->"+ (onRejected && typeof onRejected === 'function'));

      if(onFulfilled && typeof onFulfilled === 'function') this.onFulfilledCallbacks.push(onFulfilled);
      else this.onFulfilledCallbacks.push(undefined); // to keep the array's indexes in sync esp w.r.t promises array

      if(onRejected && typeof onRejected === 'function') this.onRejectedCallbacks.push(onRejected);
      else this.onRejectedCallbacks.push(undefined);

      let res = null,rej = null;
      const newPromise = new TestPromise((resolve,reject)=>{
        this.res = resolve;
        this.rej = reject;
        // console.log("In new constructor..res::"+this.res+"  ,rej::"+this.rej);
      });
      // console.log("Before pushing..res::"+this.res+"  ,rej::"+this.rej);
      this.deferreds.push({'resolve':this.res,'reject':this.rej});
      this.registeredPromises.push(newPromise);

      // console.log("In testPromise.js, this.status::" + this.status);
      if(this.status!='PENDING') {
            //ToDo:: to call onFulfilled/onRejected only when execution call stack contains platform code
            //Approach : By submitting it in microtask queue?

            //ToDo: onFulfilled/onRejected must be called as functions without 'this'
            //Approach : using strict as first line? also what about the this I'm using here for the sake of clarity?

        //From 2.2.7.1 :: If either onFulfilled or onRejected returns a value x, run the Promise Resolution Procedure [[Resolve]](promise2, x)           
        let d = this.deferreds[this.deferreds.length-1];

        try{
            
            let x;
            // console.log("In then(),when root promise is already Resolved status:: "+ this.status);

            if(this.status=='FULFILLED') { //since value can be undefined
              // console.log("In then(),value when root promise is FULFILLED value:: "+ JSON.stringify(this.value));

              // console.log("In then(),when root promise is FULFILLED onFulfilled:: "+ onFulfilled);
             
              if(typeof onFulfilled === 'function') x = onFulfilled(this.value);
              else x= this.value;

              // if(x==d)  return d.reject(new TypeError("resolution value can't be the same promise!"));

              // console.log("In then(),when root promise is FULFILLED x:: "+ x);
              
              d.resolve(x); // <-- this will run resolve() of newPromise
            }
            else {
              
              if(typeof onRejected === 'function') {
                x = onRejected(this.reason);

                // if(x==d)  return d.reject(new TypeError(this.reason));

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

