import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-webhooks',
  templateUrl: './webhooks.component.html',
  styleUrls: ['./webhooks.component.scss']
})
export class WebhooksComponent implements OnInit {

  depositConfirming = {
    code: 'deposit/confirming',
    data: {
      id: 'eb5b3138ff0dbcb060eb111b7609d01d',
      appId: '84U0IRP0rdC57AHfwRQc',
      accountId: 'pwBBKwhhVXJ16xtEcgKA',
      blockHeight: 2104164,
      paymentId: '6a8db2c83a34f29275d3cfad7100944168c46fd5d43e074aa038e18a0410c7dd',
      depositAddress: 'TRTLuxVTfpvXTXbsQxzqy5KHyHXTQZbtEHnAsorKPqkweHzDRcRyM28g6jJMQjBoocYqsjtR3G5n1ipuDpn6VbqZQWnQ198HZcD',
      amount: 25,
      integratedAddress: 'TRTLuxsFnkbHRdfoKCFc8KJ6Rzvp1TdqLHdJctadbENjAZx5mhgXqQXA6kNfcuNnap94kdBUwnfvPHvh82YufKFmHbXLoKCzfHLXTXbsQxzqy5KHyHXTQZbtEHnAsorKPqkweHzDRcRyM28g6jJMQjBoocYqsjtR3G5n1ipuDpn6VbqZQWnQ1D22qvB',
      txHash: 'e392965de03d3553df994baffba2bbb027ec83c947c4ddec9d6791cc86bca588',
      createdDate: 1576336806682,
      status: 'confirming',
      accountCredited: false,
      lastUpdate: 1576336806682,
      cancelled: false
    }
  };

  depositSucceeded = {
    code: 'deposit/succeeded',
    data: {
      amount: 25,
      appId: '84U0IRP0rdC57AHfwRQc',
      blockHeight: 2104164,
      cancelled: false,
      createdDate: 1576336806682,
      depositAddress: 'TRTLuxVTfpvXTXbsQxzqy5KHyHXTQZbtEHnAsorKPqkweHzDRcRyM28g6jJMQjBoocYqsjtR3G5n1ipuDpn6VbqZQWnQ198HZcD',
      id: 'eb5b3138ff0dbcb060eb111b7609d01d',
      integratedAddress: 'TRTLuxsFnkbHRdfoKCFc8KJ6Rzvp1TdqLHdJctadbENjAZx5mhgXqQXA6kNfcuNnap94kdBUwnfvPHvh82YufKFmHbXLoKCzfHLXTXbsQxzqy5KHyHXTQZbtEHnAsorKPqkweHzDRcRyM28g6jJMQjBoocYqsjtR3G5n1ipuDpn6VbqZQWnQ1D22qvB',
      lastUpdate: 1576337042609,
      paymentId: '6a8db2c83a34f29275d3cfad7100944168c46fd5d43e074aa038e18a0410c7dd',
      status: 'completed',
      txHash: 'e392965de03d3553df994baffba2bbb027ec83c947c4ddec9d6791cc86bca588',
      accountCredited: true,
      accountId: 'pwBBKwhhVXJ16xtEcgKA'
    }
  };

  depositCancelled = {
    code: 'deposit/cancelled',
    data: {
      amount: 25,
      appId: '84U0IRP0rdC57AHfwRQc',
      blockHeight: 0,
      cancelled: true,
      createdDate: 1576336806682,
      depositAddress: 'TRTLuxVTfpvXTXbsQxzqy5KHyHXTQZbtEHnAsorKPqkweHzDRcRyM28g6jJMQjBoocYqsjtR3G5n1ipuDpn6VbqZQWnQ198HZcD',
      id: 'eb5b3138ff0dbcb060eb111b7609d01d',
      integratedAddress: 'TRTLuxsFnkbHRdfoKCFc8KJ6Rzvp1TdqLHdJctadbENjAZx5mhgXqQXA6kNfcuNnap94kdBUwnfvPHvh82YufKFmHbXLoKCzfHLXTXbsQxzqy5KHyHXTQZbtEHnAsorKPqkweHzDRcRyM28g6jJMQjBoocYqsjtR3G5n1ipuDpn6VbqZQWnQ1D22qvB',
      lastUpdate: 1576337042609,
      paymentId: '6a8db2c83a34f29275d3cfad7100944168c46fd5d43e074aa038e18a0410c7dd',
      status: 'completed',
      accountCredited: false,
      accountId: 'pwBBKwhhVXJ16xtEcgKA'
    }
  };

  withdrawalSucceeded = {
    code: 'withdrawal/succeeded',
    data: {
      id: 'mbEz7SwYhNxPRWnb8MYb',
      paymentId: 'dd1b2917f574f5ce2b0fbbfdb0c9d0be7482125fcd93436933c8fe75c38c8a4b',
      appId: '84U0IRP0rdC57AHfwRQc',
      accountId: 'jaKrijd8WjHRWTu2y8pG',
      amount: 500000,
      fees: {
        txFee: 1500,
        nodeFee: 10,
        serviceFee: 0
      },
      userDebited: true,
      address: 'TRTLv32bGBP2cfM3SdijU4TTYnCPoR33g5eTas6n9HamBvu8ozc9BZHWza5j7cmBFSgh4dmmGRongfoEEzcvuAEF8dLxixsS7he',
      timestamp: 1576340903981,
      lastUpdate: 1576341061152,
      status: 'completed',
      requestedAtBlock: 2104300,
      blockHeight: 2104302,
      failed: false,
      preparedWithdrawalId: '35ruwGoGaaSgjYAUdpJh',
      txHash: '07e8f4ee5a0dcdf3ca3ce987069f107d045def181d438696114fb6990fb3c72c',
      retries: 0
    }
  };

  withdrawalFailed = {
    code: 'withdrawal/failed',
    data: {
      id: 'mbEz7SwYhNxPRWnb8MYb',
      paymentId: 'dd1b2917f574f5ce2b0fbbfdb0c9d0be7482125fcd93436933c8fe75c38c8a4b',
      appId: '84U0IRP0rdC57AHfwRQc',
      accountId: 'jaKrijd8WjHRWTu2y8pG',
      amount: 500000,
      fees: {
        txFee: 1500,
        nodeFee: 10,
        serviceFee: 0
      },
      userDebited: false,
      address: 'TRTLv32bGBP2cfM3SdijU4TTYnCPoR33g5eTas6n9HamBvu8ozc9BZHWza5j7cmBFSgh4dmmGRongfoEEzcvuAEF8dLxixsS7he',
      timestamp: 1576340903981,
      lastUpdate: 1576341061152,
      status: 'completed',
      requestedAtBlock: 2104300,
      blockHeight: 0,
      failed: true,
      preparedWithdrawalId: '35ruwGoGaaSgjYAUdpJh',
      txHash: '07e8f4ee5a0dcdf3ca3ce987069f107d045def181d438696114fb6990fb3c72c',
      daemonErrorCode: 31,
      retries: 0
    }
  };

  constructor() { }

  ngOnInit() {
  }
}
