function callFunctionIfDefined(callback) {
    if (callback && typeof(callback) == "function") {
        callback();
    }
}

function addPushCartPriceObserver() {
    const checkIfPushCartIsConstructed = window.setInterval(() => {
        const element = document.querySelector(".push-cart__footer--price");
        if (element) {
            const observer = new MutationObserver(
                (mutationList, observer) => {
                    for (const mutation of mutationList) {
                        //when the page initially loads, the removed nodes is empty, because the element has no data
                        //after this, the removed nodes will have the old value in it, and this change will only happen when the push cart opens
                        //we can filter this initial change as the push cart will not be open on page load, and the action of opening the push cart will trigger the desired elements to load for the first time
                        //we only want to trigger changes to the elements once the elements are loaded
                        //alternatively, we could check if the elements are loaded instead, but I'm not sure what that looks like yet
                        if(mutation.removedNodes.length > 0) {
                            callFunctionIfDefined(paypalPushCartManageMessagingElementOnceLoaded);
                            callFunctionIfDefined(addPaypalButtonsWhenPushCartOpen);
                            callFunctionIfDefined(stripePushCartLoadElementsWithDelay);
                        }
                    }
                }
            );

            observer.observe(element, { childList: true});
            clearInterval(checkIfPushCartIsConstructed);
        }
    }, 200);
}
addPushCartPriceObserver();