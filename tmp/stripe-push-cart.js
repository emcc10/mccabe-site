const stripePushCartBaseUrl = window.location.origin.match(/^.+?[^/:](?=[?/]|$)/i)[0];

const stripePushCartGetCartId = () => {
    const name = `CartID5=`;
    try {
        const decodedCookie = decodeURIComponent(document.cookie);
        const ca = decodedCookie.split(";");
        for (let i = 0; i < ca.length; i += 1) {
            let c = ca[i];
            while (c.charAt(0) === " ") {
                c = c.substring(1);
            }
            if (c.indexOf(name) === 0) {
                return c.substring(name.length, c.length);
            }
        }
    } catch (e) {
        const matches = document.cookie.match(`${name}([^;]+);?`);
        if (matches && matches.length >= 2) {
            return matches[1];
        }
    }

    return "";
};

const stripePushCartHasRecurringItem = (cartData) => {
    return !!cartData?.items?.some(
        item => item.pricing.recurringPrice.everyXMonths !== ''
    );
};
const stripePushCartHasDonationItem = (cartData) => {
    return !!cartData?.items?.some(
        item => item.code.toLowerCase().includes('donation-')
    );
};

const stripePushCartHasGiftCardItem = (cartData) => {
    return !!cartData?.items?.some(
        item => item.code.toLowerCase().includes('gft')
    );
};

const stripePushCartGetCart = async (cartId) => {
    try {
        const response = await window.fetch(`${stripePushCartBaseUrl}/api/v1/carts/${cartId}`, {
            credentials: "include",
        });
        const result = await response.json();
        return result.data;
    } catch (e) {
        //
    }
    return {};
};
const stripePushCartReference = document.getElementById('stripe-push-cart');
const stripePushCartStripePublicKey = stripePushCartReference.getAttribute('data-pk');
const stripePushCartStripeUAId = stripePushCartReference.getAttribute('data-uaid');
const stripePushCartStripeApiVersion = stripePushCartReference.getAttribute('data-api-version');
const stripePushCartStripeApiBetas = stripePushCartReference.getAttribute('data-api-betas');
const stripePushCartStripeCurrencyCode = stripePushCartReference.getAttribute('data-currency-code');
const stripePushCartStripeCountryCode = stripePushCartReference.getAttribute('data-country-code');
const stripePushCartStripeBnplProviders = stripePushCartReference.getAttribute('data-active-providers');
const stripePushCartDisplayWallet = stripePushCartReference.getAttribute('data-display-wallet')?.toLowerCase() === 'true';
const stripePushCartStripe = Stripe(stripePushCartStripePublicKey, {
    stripeAccount: stripePushCartStripeUAId,
});
const stripePushCartStripeElements = stripePushCartStripe.elements({ locale: 'en-US' });

let cartMessagingElement;
async function stripePushCartMountBNPLMessaging(cartData) {
    if (stripePushCartStripeBnplProviders === '[]') {
        return;
    }
    const hasRecurringItem = stripePushCartHasRecurringItem(cartData);
    const hasDonationItem = stripePushCartHasDonationItem(cartData);
    const hasGiftCardItem = stripePushCartHasGiftCardItem(cartData);
    if (!hasRecurringItem && !hasDonationItem && !hasGiftCardItem) {
        const pushCartNewTotal = stripePushCartGetTotal(cartData);
        const options = {
            amount: pushCartNewTotal,
            currency: stripePushCartStripeCurrencyCode,
            paymentMethods: JSON.parse(stripePushCartStripeBnplProviders),
            countryCode: stripePushCartStripeCountryCode,
        };
        const existingMessagingElement = document.getElementById('pushcart-messaging-element');
        if (cartMessagingElement && existingMessagingElement.children.length > 0) {
            cartMessagingElement.update(options);
        } else {
            cartMessagingElement = stripePushCartStripeElements.create('paymentMethodMessaging', options);
            cartMessagingElement.mount('#pushcart-messaging-element');
        }
    } else {
        if (cartMessagingElement) {
            cartMessagingElement.unmount();
        }
    }
}

function stripePushCartGetTotal(cartData) {
    if (!cartData?.totals?.grandTotal) {
        return 0;
    }
    return Math.round((cartData?.totals?.grandTotal > 0 ? cartData.totals.grandTotal : 0) * 100);
}

const stripePushCartAddMessageElement = () => {
    const pushCartFooter = document.querySelector(".push-cart__payment");
    const existingDiv = document.getElementById("pushcart-messaging-element");
    if (pushCartFooter && !existingDiv) {
        const newDiv = document.createElement("div");
        newDiv.setAttribute("id", "pushcart-messaging-element");
        newDiv.setAttribute("style", "font-size: 14px !important; margin-bottom: 8px;");
        pushCartFooter.prepend(newDiv);
    }
};

const stripeCreatePaymentRequestDiv = () => {
    const paymentRequestDiv = document.createElement('div');
    paymentRequestDiv.setAttribute('id', 'payment-request-button');
    paymentRequestDiv.setAttribute('style', 'max-width: 290px; min-height: 30px; margin-top: 10px;');
    return paymentRequestDiv;
};

const stripeLoadPaymentRequestScript = async (cartData) => {
    const currentTotal = stripePushCartGetTotal(cartData);
    const existingPaymentRequestElement = document.getElementById("vPayScript");
    if(existingPaymentRequestElement) {
        existingPaymentRequestElement.setAttribute('data-current-total', currentTotal.toFixed(0));
        callFunctionIfDefined(updateVpayServicePaymentRequest);
    }
    else {
        const paymentRequestElement = document.createElement('script');
        paymentRequestElement.setAttribute('id', 'vPayScript');
        paymentRequestElement.setAttribute('src', '/a/j/vpay-request-button.js');
        paymentRequestElement.setAttribute('data-public-key', stripePushCartStripePublicKey);
        paymentRequestElement.setAttribute('data-api-account-id', stripePushCartStripeUAId);
        paymentRequestElement.setAttribute('data-api-version', stripePushCartStripeApiVersion);
        paymentRequestElement.setAttribute('data-api-betas', stripePushCartStripeApiBetas);
        paymentRequestElement.setAttribute('data-currency-code', stripePushCartStripeCurrencyCode);
        paymentRequestElement.setAttribute('data-country-code', stripePushCartStripeCountryCode);
        paymentRequestElement.setAttribute('data-current-total', currentTotal.toFixed(0));
        document.head.appendChild(paymentRequestElement);
    }
};

const stripePushCartAddPaymentRequestButton = (cartData) => {
    const pushCartFooter = document.querySelector('.push-cart__footer');
    const existingVPayDiv = document.getElementById('payment-request-button');
    if (pushCartFooter && stripePushCartDisplayWallet && !existingVPayDiv) {
        const paymentRequestDiv = stripeCreatePaymentRequestDiv();
        pushCartFooter.append(paymentRequestDiv);
    }
    stripeLoadPaymentRequestScript(cartData);
};

const stripePushCartLoadElements = async () => {
    const cartId = stripePushCartGetCartId();
    const cartData = await stripePushCartGetCart(cartId);
    if (stripePushCartGetTotal(cartData) > 0 && stripePushCartReference) {
        stripePushCartAddMessageElement();
        stripePushCartMountBNPLMessaging(cartData);
        stripePushCartAddPaymentRequestButton(cartData);
    }
}

const stripePushCartLoadElementsWithDelay = async () => {
    if (!stripePushCartDisplayWallet && stripePushCartStripeBnplProviders === '[]') {
        return
    };
    const checkIfCartLoaded = window.setInterval(() => {
        const loadingDiv = document.getElementsByClassName('push-cart--vol-loader__contents');
        if (!loadingDiv.length) {
            stripePushCartLoadElements();
            clearInterval(checkIfCartLoaded);
        }
    }, 200);
};

let stripeClassWatcher;
function stripePushCartAddClassNameWatcher() {
    const checkAndSetClassWatch = window.setInterval(() => {
        const element = document.querySelector('body');
        if (element && !stripeClassWatcher) {
            stripeClassWatcher = new ClassNameWatcher(
                document.querySelector('body'),
                'push-cart-open',
                stripePushCartLoadElementsWithDelay,
                () => {},
            );
        }
        if (element && stripeClassWatcher) {
            clearInterval(checkAndSetClassWatch)
        }
    }, 500);
}



stripePushCartAddClassNameWatcher();
