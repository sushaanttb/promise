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
        try{
                if(!x) this.updatePromiseStatus(x,resolutionType);
                else if(x instanceof TestPromise) x.then((v)=>this.resolve(v), (r) => this.reject(r)); //<-- adopting it's state
                else if(typeof x === 'object' || typeof x === 'function'){// <-- typeof x === 'function' check is based from tests.
              
                    if(Object.prototype.hasOwnProperty.call(x, 'then')){
                        let thenProperty = x.then;

                        if(typeof thenProperty === 'function'){

                          let invocationCnt = 0;
                          const resolvePromise = (y) => {
                            
                            if(invocationCnt++ >0) return; 
                          
                                try{
                                  this.resolve(y); 
                                }catch(error){
                                  this.reject(error);
                                }
                            }
                          const rejectPromise = (r) => {

                            if(invocationCnt++ >0) return; 
                            
                              try{
                                 this.reject(r);
                              }catch(error){
                                 this.reject(error);
                              }
                            }
                          
                          //handling 2.3.3.3.4: If calling `then` throws an exception `e`
                          try{
                            thenProperty.call(x,resolvePromise,rejectPromise);
                          }catch(error){
                            //if in the then callback it already resolved once, we need to ignore if there was any error afterwards
                            //added check of invocationCnt==0 ,to detect multiple invocations to then() TC: 2.3.3.3.4.1, `resolvePromise` was called with an asynchronously-fulfilled promise
                            if(this.status=='PENDING' && invocationCnt==0) this.reject(error);
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
    }

    resolveCallbacks=()=>{

        for(let i=0; i<this.deferreds.length; i++){

              let deferred = this.deferreds[i];
              let currentFulfillCallback = this.onFulfilledCallbacks[i];
              let currentRejectCallback = this.onRejectedCallbacks[i];

              try{
                
                    if(this.status=='FULFILLED' && (!currentFulfillCallback || typeof currentFulfillCallback != 'function')) {
                          deferred.resolve(this.value);// <-- fulfill the corresponding promise with the value directly(2.2.7.3)
                    }else if(this.status=='REJECTED' && (!currentRejectCallback || typeof currentRejectCallback !='function')) {
                          deferred.reject(this.reason); // <-- reject the corresponding promise with reason directly(2.2.7.4)
                    }else{
      
                      let result;
                        // 2.2.4, onFulfilled or onRejected must not be called until the execution context stack contains only platform code
                        setTimeout(()=>{
                        
                          try{
                            this.status=='FULFILLED'? (result = currentFulfillCallback(this.value)) : (result = currentRejectCallback(this.reason));  
                            deferred.resolve(result);
                          }catch(error){
                            deferred.reject(error);
                          }
                        },0);
                          
                  }
              }catch(error){
                deferred.reject(error);
              }finally{
                this.deferreds.splice(i,1);
                this.onFulfilledCallbacks.splice(i,1);
                this.onRejectedCallbacks.splice(i,1);
                this.registeredPromises.splice(i,1);
                i--;
              }
          }
    }

    //ToDo:: to make it private
    resolve=(val)=>{
      
      if (this.status!='PENDING') return;
      if (val===this) return this.reject(new TypeError("resolution value can't be the same promise!")); //(From the Spec,2.3.1)

      this.genericDeduce(val,'fulfill');
      // console.log("Resolve called with val::"+ JSON.stringify(val) +" , Promise "+this.status +" with value:: "+JSON.stringify(this.value));
      
      //since this.value can be undefined
      if(this.status=='FULFILLED') this.resolveCallbacks();

    }

    //ToDo:: to make it private
    reject=(rsn)=>{

      if (this.status!='PENDING') return;
      if (rsn===this) return this.reject(new TypeError("rejection reason can't be the same promise!")); //(From the Spec ,2.3.1)

      this.status = 'REJECTED';
      this.reason = rsn; 
      
      //since this.reason can be undefined
      if(this.status=='REJECTED') this.resolveCallbacks();
      
    }

    then=(onFulfilled, onRejected)=>{
    
      if(onFulfilled && typeof onFulfilled === 'function') this.onFulfilledCallbacks.push(onFulfilled);
      else this.onFulfilledCallbacks.push(undefined); // to keep the array's indexes in sync esp w.r.t promises array

      if(onRejected && typeof onRejected === 'function') this.onRejectedCallbacks.push(onRejected);
      else this.onRejectedCallbacks.push(undefined);


      let res = null,rej = null;
      const newPromise = new TestPromise((resolve,reject)=>{
        this.res = resolve;
        this.rej = reject;
      });
      this.deferreds.push({'resolve':this.res,'reject':this.rej});
      this.registeredPromises.push(newPromise);

      if(this.status!='PENDING') {
      
        //From 2.2.7.1 :: If either onFulfilled or onRejected returns a value x, run the Promise Resolution Procedure [[Resolve]](promise2, x)           
        let d = this.deferreds[this.deferreds.length-1];

        try{
            
            let x;
            if(this.status=='FULFILLED') { //since value can be undefined
            
              // 2.2.4, onFulfilled or onRejected must not be called until the execution context stack contains only platform code
              setTimeout(()=>{
               try{
                  if(typeof onFulfilled === 'function') x = onFulfilled(this.value);
                  else x= this.value;

                  d.resolve(x);
                }catch(error){
                  d.reject(error);
                }
              },0);

            }
            else {
              
              if(typeof onRejected === 'function') {
                
                // 2.2.4, onFulfilled or onRejected must not be called until the execution context stack contains only platform code
                setTimeout(()=>{
                    try{
                      x = onRejected(this.reason);
                      d.resolve(x);
                    }catch(error){
                      d.reject(error);
                    }
                    
                },0);

         
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

