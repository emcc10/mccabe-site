<?php
/**
 * Volusion shopper auth helpers for boards API.
 */
function mc_boards_customer_id() {
    $direct = ['CustomerID', 'customerid', 'CustomerId', 'Volusion_CustomerId', 'VolusionCustomerID'];
    foreach ($direct as $name) {
        if (!empty($_COOKIE[$name])) {
            $v = trim((string) $_COOKIE[$name]);
            if ($v !== '' && $v !== '0') {
                return $v;
            }
        }
    }
    foreach ($_COOKIE as $key => $val) {
        $k = strtolower((string) $key);
        if (strpos($k, 'customer') === false) {
            continue;
        }
        if (strpos($k, 'id') === false && substr($k, -2) !== 'id') {
            continue;
        }
        $v = trim((string) $val);
        if ($v !== '' && $v !== '0') {
            return $v;
        }
    }
    return '';
}

function mc_boards_is_signed_in() {
    return mc_boards_customer_id() !== '';
}

function mc_boards_data_file($customerId) {
    $key = hash('sha256', $customerId);
    return __DIR__ . '/data/cust_' . $key . '.json';
}

function mc_boards_read_items($customerId) {
    $file = mc_boards_data_file($customerId);
    $list = [];
    if (is_readable($file)) {
        $list = json_decode((string) file_get_contents($file), true);
        if (!is_array($list)) {
            $list = [];
        }
    }
    return array_values($list);
}
