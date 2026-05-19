export type SalePaymentStatus =
  | "pending_verification"
  | "paid_verified"
  | "payment_rejected";

export interface SalesRecordItem {
  id: number;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface SalesRecord {
  id: number;
  invoiceNumber: string;
  invoiceCreatedAt: string;
  checkoutSubtotal: number;
  paymentStatus: SalePaymentStatus;
  customerFirstName: string | null;
  customerMiddleName: string | null;
  customerLastName: string | null;
  receiptFilePath: string | null;
  receiptUploadedBy: "user" | "owner" | null;
  createdAt: string;
  items: SalesRecordItem[];
}
