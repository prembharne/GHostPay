import { parseAbi } from 'viem';
export const escrowAbi = parseAbi([
  'function createETHPayment(uint256 expiry) payable returns (uint256 paymentId)',
  'function claimPayment(uint256 paymentId, address recipient, uint256 authorizationDeadline, bytes signature)',
  'function refundPayment(uint256 paymentId)',
  'function nextPaymentId() view returns (uint256)',
  'function getPayment(uint256 paymentId) view returns ((address sender,address token,uint256 amount,uint256 expiry,uint8 status))',
  'event PaymentCreated(uint256 indexed paymentId,address indexed sender,address token,uint256 amount,uint256 expiry)',
  'event PaymentClaimed(uint256 indexed paymentId,address indexed recipient,uint256 amount)',
  'event PaymentRefunded(uint256 indexed paymentId,address indexed sender,uint256 amount)',
  'error ZeroAmount()', 'error InvalidExpiry()', 'error PaymentNotActive()', 'error PaymentExpired()',
  'error InvalidDeadline()', 'error InvalidRecipient()', 'error InvalidSignature()', 'error NotSender()',
  'error NotExpired()', 'error TransferFailed()', 'error ReentrancyGuardReentrantCall()',
]);
