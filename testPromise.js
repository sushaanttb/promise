class TestPromise{

    status=0;
    value;
    reason;
    onResolveCallbacks = new Array();
    onRejectCallbacks = new Array();
    registeredPromises = new Array();

    //where f is a function with 2 args : resolve/reject
    //def. of how resolve/reject works will be provided from client
    //ToDo:: need to check the further syntax of defining it.
    constructor(f){}

    resolve(val){
      this.status=1; //Set the Status to Resolved
      this.value = val;

      for(let i=0; i<onResolveCallbacks.length(); i++){
          
          let currentResolveCallback = onResolveCallbacks[i];
          let correspondingPromise = registeredPromises[i];
          
          if(!currentResolveCallback || typeOf(currentResolveCallback)!=Function) continue;
          
          try{
            
            //Invoke the callback with the val param received
            let result = currentResolveCallback(val);
           
            if(result instanceof TestPromise){ // i.e. a promise itself
                //if result is a promise, then attach our registered task as a callback to it's then method once that completes
                result.then((v) => correspondingPromise(v,null),
                            (r) => correspondingPromise(null,r));
            } 
            else if( typeof(result) == Object)// an object or a thenable 
            {
                //if result has property then
                if(result.hasOwnProperty('then')){
                    let thenProperty = result.then;

                    if(typeOf(thenProperty) == Function){
                    //Q: but how are sure to call it w/o args?
                       correspondingPromise(thenProperty(),null);// this will call resolve method for this promise
                    // and it will resolve it acc. on same basis i.e. if it's a simple value, another promise or thenable
                    
                    }else{ // if it's not a function but simply a property with some value.
                      correspondingPromise(thenProperty,null);
                    }
                }
                else // if it's an object but does not has a 'then', pass that object to resolve the registered promise.
                { correspondingPromise(result,null)}
            }
            // if it's a simple value
            else correspondingPromise(result,null);
           
          }catch(error){
            correspondingPromise(null,error);
          }
      }

    }

    reject(rsn){
      this.status=2;
      this.reason = rsn;

       for(let i=0; i<this.onRejectCallbacks.length(); i++){
          
          let currentRejectCallback = this.onRejectCallbacks[i];
          let correspondingPromise = this.registeredPromises[i];
          
          if(!currentRejectCallback || typeOf(currentRejectCallback)!=Function) continue;

          try{
            
            //Invoke the callback with the rsn param received
            let result = currentRejectCallback(rsn);
            // Q: can rejection result further be a Promise(don't think so!) or thenable?

            correspondingPromise(null,result);
           
          }catch(error){
            correspondingPromise(null,error);
          }finally{
             //cleanup of all registered callbacks and promises
             this.onRejectCallbacks.shift();
             this.registeredPromises.shift();
          }
      }
    }

    then(onResolve, onReject){
  
      if(typeof(onResolve)==Function) this.onResolveCallbacks.push(onResolve);
      else this.onResolveCallbacks.push(null); // to keep the array in sync

      if(typeof(onReject)==Function) this.onRejectCallbacks.push(onReject);
      else this.onRejectCallbacks.push(null);

      let newPromise = (res,rej) => new TestPromise(function(resolve,reject){
          if(res) resolve(res);
          else reject(rej);
      })

      this.registeredPromises.push(newPromise);
      
      //IF current promise is already resolved/rejected then we can entertain it immediately
      if(status!=0) {
        newPromise(this.value,this.reason);
        //remove the recently added elements from callback & promise array, since we won;t be needing them 
        if(typeof(onResolve)==Function) this.onResolveCallbacks.shift();
        if(typeof(onReject)==Function) this.onResolveCallbacks.shift();
        this.registeredPromises.shift();
       }

      return newPromise;
  }

}
