import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCcw } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SalePaymentStatus, SalesRecord } from "@/types/sales";
import { useSalesCheckoutState } from "@/modules/sales-checkout/hooks/useSalesCheckoutState";
import { supabase } from "@/utils/supabase";

type SalesCheckoutModulePanelProps = {
  session: Session | null;
};

const PAGE_SIZE = 10;
const RECEIPTS_BUCKET = import.meta.env.VITE_SUPABASE_RECEIPTS_BUCKET ?? "payment-receipts";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatCurrency = (amount: number): string => currencyFormatter.format(amount);

const formatDateTime = (value: string): string => {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }
  return dateTimeFormatter.format(parsedDate);
};

const getPaymentStatusLabel = (status: SalePaymentStatus): string => {
  if (status === "paid_verified") return "Paid";
  if (status === "payment_rejected") return "Rejected";
  return "Pending";
};

const getPaymentStatusClassName = (status: SalePaymentStatus): string => {
  if (status === "paid_verified") {
    return "border-black/15 bg-black text-white";
  }

  if (status === "payment_rejected") {
    return "border-black/20 bg-black/10 text-black";
  }

  return "border-black/10 bg-black/5 text-black";
};

const formatCustomerName = (record: SalesRecord): string => {
  const lastName = record.customerLastName?.trim();
  const firstName = record.customerFirstName?.trim();
  const middleName = record.customerMiddleName?.trim();

  if (!lastName || !firstName) return "Not provided";
  return `${lastName}, ${firstName}${middleName ? ` ${middleName}` : ""}`;
};

const getReceiptSummary = (record: SalesRecord): string => {
  if (!record.receiptFilePath) return "No";
  if (record.receiptUploadedBy === "user") return "Yes (Customer)";
  if (record.receiptUploadedBy === "owner") return "Yes (Owner)";
  return "Yes (Unknown)";
};

const isAbsoluteUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const extractObjectPathFromStorageUrl = (
  rawValue: string,
  bucketName: string
): string | null => {
  const markers = [
    `/storage/v1/object/public/${bucketName}/`,
    `/storage/v1/object/sign/${bucketName}/`,
    `/storage/v1/object/authenticated/${bucketName}/`,
  ];

  for (const marker of markers) {
    const markerIndex = rawValue.indexOf(marker);
    if (markerIndex >= 0) {
      const valueAfterMarker = rawValue.slice(markerIndex + marker.length).split("?")[0];
      const decodedPath = decodeURIComponent(valueAfterMarker.trim());
      return decodedPath.length > 0 ? decodedPath : null;
    }
  }

  return null;
};

const resolveReceiptPath = (
  rawValue: string,
  bucketName: string
): { directUrl: string | null; objectPath: string | null } => {
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    return { directUrl: null, objectPath: null };
  }

  const objectPathFromStorageUrl = extractObjectPathFromStorageUrl(trimmed, bucketName);
  if (objectPathFromStorageUrl) {
    return { directUrl: null, objectPath: objectPathFromStorageUrl };
  }

  if (isAbsoluteUrl(trimmed)) {
    return { directUrl: trimmed, objectPath: null };
  }

  const normalized = decodeURIComponent(trimmed.replace(/^\/+/, ""));
  if (normalized.startsWith(`${bucketName}/`)) {
    return { directUrl: null, objectPath: normalized.slice(bucketName.length + 1) };
  }

  if (normalized.startsWith(`public/${bucketName}/`)) {
    return { directUrl: null, objectPath: normalized.slice(`public/${bucketName}/`.length) };
  }

  return { directUrl: null, objectPath: normalized };
};

const isPdfPath = (value: string): boolean => /\.pdf(?:$|\?)/i.test(value);

export function SalesCheckoutModulePanel({ session }: SalesCheckoutModulePanelProps) {
  const state = useSalesCheckoutState(session);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDetailsSheetOpen, setIsDetailsSheetOpen] = useState(false);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [isReceiptPreviewLoading, setIsReceiptPreviewLoading] = useState(false);
  const [receiptPreviewErrorMessage, setReceiptPreviewErrorMessage] = useState<string | null>(null);
  const [approvalActionMessage, setApprovalActionMessage] = useState<string>("");
  const selectedSalesRecord = state.selectedSalesRecord;

  const totalPages = Math.max(1, Math.ceil(state.salesRecords.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage((previous) => Math.min(Math.max(previous, 1), totalPages));
  }, [totalPages]);

  useEffect(() => {
    const receiptPath = selectedSalesRecord?.receiptFilePath;
    if (!receiptPath) {
      setReceiptPreviewUrl(null);
      setReceiptPreviewErrorMessage(null);
      setIsReceiptPreviewLoading(false);
      return;
    }

    const { directUrl, objectPath } = resolveReceiptPath(receiptPath, RECEIPTS_BUCKET);
    if (directUrl) {
      setReceiptPreviewUrl(directUrl);
      setReceiptPreviewErrorMessage(null);
      setIsReceiptPreviewLoading(false);
      return;
    }

    if (!objectPath) {
      setReceiptPreviewUrl(null);
      setReceiptPreviewErrorMessage("Receipt path is invalid.");
      setIsReceiptPreviewLoading(false);
      return;
    }

    let isCancelled = false;
    const loadReceiptPreview = async () => {
      setIsReceiptPreviewLoading(true);
      setReceiptPreviewErrorMessage(null);

      const { data: signedData, error: signedError } = await supabase.storage
        .from(RECEIPTS_BUCKET)
        .createSignedUrl(objectPath, 60 * 60);

      if (isCancelled) return;

      if (signedData?.signedUrl) {
        setReceiptPreviewUrl(signedData.signedUrl);
        setIsReceiptPreviewLoading(false);
        return;
      }

      setReceiptPreviewUrl(null);
      setReceiptPreviewErrorMessage(
        `Unable to load receipt preview from bucket "${RECEIPTS_BUCKET}". ${signedError?.message ?? "Check bucket/path settings."}`
      );
      setIsReceiptPreviewLoading(false);
    };

    void loadReceiptPreview();

    return () => {
      isCancelled = true;
    };
  }, [selectedSalesRecord?.id, selectedSalesRecord?.receiptFilePath]);

  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return state.salesRecords.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, state.salesRecords]);

  const selectedRecordItemCount =
    selectedSalesRecord?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const hasUploadedReceipt = Boolean(selectedSalesRecord?.receiptFilePath?.trim());
  const canApproveSelectedRecord = Boolean(
    selectedSalesRecord &&
      hasUploadedReceipt &&
      selectedSalesRecord.paymentStatus !== "paid_verified"
  );

  const pageStartRecord =
    state.salesRecords.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEndRecord = Math.min(currentPage * PAGE_SIZE, state.salesRecords.length);

  useEffect(() => {
    setApprovalActionMessage("");
  }, [selectedSalesRecord?.id]);

  const handleApproveRecord = async () => {
    if (!selectedSalesRecord) return;
    if (!hasUploadedReceipt) {
      setApprovalActionMessage("Upload receipt first before approving this payment.");
      return;
    }

    const isUpdated = await state.updateRecordPaymentStatus(
      selectedSalesRecord.id,
      "paid_verified",
      {
        receiptFilePath: selectedSalesRecord.receiptFilePath,
        receiptUploadedBy: selectedSalesRecord.receiptUploadedBy,
      }
    );
    if (!isUpdated) return;

    setApprovalActionMessage("Record approved successfully.");
  };

  return (
    <Card className="border-black/15 shadow-none">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-2xl tracking-tight">Sales / Checkout</CardTitle>
            <CardDescription className="text-neutral-600">
              Completed storefront orders from the landing page.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-black/20"
            disabled={state.isRefreshingRecords || state.isLoadingRecords}
            onClick={() => void state.fetchSalesRecords({ refresh: true })}
          >
            <RefreshCcw className="mr-2 size-4" />
            {state.isRefreshingRecords ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="secondary"
            className="rounded-full border border-black/10 bg-black/5 text-black"
          >
            {state.salesRecords.length} record{state.salesRecords.length === 1 ? "" : "s"}
          </Badge>
          <Badge
            variant="secondary"
            className="rounded-full border border-black/10 bg-black/5 text-black"
          >
            {state.totalItemsSold} item{state.totalItemsSold === 1 ? "" : "s"} sold
          </Badge>
          <Badge
            variant="secondary"
            className="rounded-full border border-black/10 bg-black/5 text-black"
          >
            {formatCurrency(state.totalSalesValue)} total sales
          </Badge>
        </div>

        {state.salesErrorMessage && <p className="text-sm text-black">{state.salesErrorMessage}</p>}

        {state.isLoadingRecords ? (
          <p className="text-sm text-neutral-600">Loading sales records...</p>
        ) : state.salesRecords.length === 0 ? (
          <p className="text-sm text-neutral-600">
            No sales records found yet. Once checkout inserts into `sales_records`, records will
            appear here.
          </p>
        ) : (
          <>
            <div className="rounded-xl border border-black/10">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Checkout Time</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">Receipt</TableHead>
                    <TableHead className="text-right">Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map((record) => {
                    const quantityCount = record.items.reduce(
                      (sum, item) => sum + item.quantity,
                      0
                    );
                    const isSelected = state.selectedSalesRecordId === record.id;

                    return (
                      <TableRow
                        key={record.id}
                        data-state={isSelected ? "selected" : undefined}
                        className="cursor-pointer"
                        onClick={() => {
                          state.setSelectedSalesRecordId(record.id);
                          setIsDetailsSheetOpen(true);
                        }}
                      >
                        <TableCell className="font-medium">{record.invoiceNumber}</TableCell>
                        <TableCell>{formatCustomerName(record)}</TableCell>
                        <TableCell>{formatDateTime(record.invoiceCreatedAt)}</TableCell>
                        <TableCell className="text-right">{quantityCount}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(record.checkoutSubtotal)}
                        </TableCell>
                        <TableCell className="text-right">{getReceiptSummary(record)}</TableCell>
                        <TableCell className="text-right">
                          <Badge
                            className={`rounded-full ${getPaymentStatusClassName(record.paymentStatus)}`}
                          >
                            {getPaymentStatusLabel(record.paymentStatus)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 px-3 py-2">
              <p className="text-xs text-neutral-600">
                Showing {pageStartRecord}-{pageEndRecord} of {state.salesRecords.length} invoices
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-black/20"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
                >
                  <ChevronLeft className="mr-1 size-4" />
                  Previous
                </Button>
                <span className="text-xs text-neutral-600">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-black/20"
                  disabled={currentPage >= totalPages}
                  onClick={() =>
                    setCurrentPage((previous) => Math.min(totalPages, previous + 1))
                  }
                >
                  Next
                  <ChevronRight className="ml-1 size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>

      <Sheet open={isDetailsSheetOpen} onOpenChange={setIsDetailsSheetOpen}>
        <SheetContent side="right" className="flex h-full w-full flex-col overflow-hidden p-0 sm:max-w-2xl">
          <SheetHeader className="shrink-0 border-b border-black/10">
            <SheetTitle className="font-sans text-base">
              {state.selectedSalesRecord
                ? `Invoice ${selectedSalesRecord?.invoiceNumber}`
                : "Product Details"}
            </SheetTitle>
            <SheetDescription>
              {state.selectedSalesRecord
                ? `Saved ${formatDateTime(selectedSalesRecord?.createdAt ?? "")}`
                : "Select an invoice to view product details."}
            </SheetDescription>
          </SheetHeader>

          {selectedSalesRecord ? (
            <>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <div className="grid gap-2 rounded-xl border border-black/10 p-3 text-sm">
                  <p>
                    <span className="font-medium">Customer:</span>{" "}
                    {formatCustomerName(selectedSalesRecord)}
                  </p>
                  <p>
                    <span className="font-medium">Receipt Uploaded:</span>{" "}
                    {getReceiptSummary(selectedSalesRecord)}
                  </p>
                  <p>
                    <span className="font-medium">Total Items:</span> {selectedRecordItemCount}
                  </p>
                  <p>
                    <span className="font-medium">Subtotal:</span>{" "}
                    {formatCurrency(selectedSalesRecord.checkoutSubtotal)}
                  </p>
                </div>

                <div className="rounded-xl border border-black/10">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Line Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedSalesRecord.items.map((item) => (
                        <TableRow key={`${selectedSalesRecord.id}-${item.id}`}>
                          <TableCell>{item.productName}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.lineTotal)}</TableCell>
                        </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

                <Separator className="bg-black/10" />

                <div className="space-y-2 rounded-xl border border-black/10 p-3">
                  <p className="text-sm font-medium">Uploaded Receipt</p>
                  {!selectedSalesRecord.receiptFilePath ? (
                    <p className="text-sm text-neutral-600">No receipt uploaded for this invoice.</p>
                  ) : isReceiptPreviewLoading ? (
                    <p className="text-sm text-neutral-600">Loading receipt preview...</p>
                  ) : receiptPreviewErrorMessage ? (
                    <p className="text-sm text-black">{receiptPreviewErrorMessage}</p>
                  ) : receiptPreviewUrl ? (
                    <div className="space-y-2">
                      {isPdfPath(receiptPreviewUrl) || isPdfPath(selectedSalesRecord.receiptFilePath ?? "") ? (
                        <iframe
                          src={receiptPreviewUrl}
                          title={`Receipt for invoice ${selectedSalesRecord.invoiceNumber}`}
                          className="h-[26rem] w-full rounded-md border border-black/10 bg-white"
                        />
                      ) : (
                        <img
                          src={receiptPreviewUrl}
                          alt={`Receipt for invoice ${selectedSalesRecord.invoiceNumber}`}
                          className="max-h-[26rem] w-full rounded-md border border-black/10 bg-white object-contain"
                          loading="lazy"
                          onError={() => {
                            setReceiptPreviewErrorMessage(
                              `Receipt preview failed to render. Verify file type and bucket "${RECEIPTS_BUCKET}".`
                            );
                          }}
                        />
                      )}
                      <a
                        href={receiptPreviewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs underline underline-offset-2"
                      >
                        Open receipt in new tab
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-600">No receipt preview available.</p>
                  )}
                </div>
              </div>

              <div className="shrink-0 space-y-2 border-t border-black/10 bg-white p-4">
                {!hasUploadedReceipt && (
                  <p className="text-xs text-neutral-600">
                    A payment receipt is required before this record can be approved.
                  </p>
                )}
                {selectedSalesRecord.paymentStatus === "paid_verified" && (
                  <p className="text-xs text-neutral-600">This record is already approved.</p>
                )}
                {approvalActionMessage && <p className="text-xs text-black">{approvalActionMessage}</p>}
                {state.paymentStatusActionErrorMessage && (
                  <p className="text-xs text-black">{state.paymentStatusActionErrorMessage}</p>
                )}
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  disabled={!canApproveSelectedRecord || state.isUpdatingPaymentStatus}
                  onClick={() => void handleApproveRecord()}
                >
                  {state.isUpdatingPaymentStatus ? "Completing..." : "Order Complete"}
                </Button>
              </div>
            </>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm text-neutral-600">
              No invoice selected.
            </div>
          )}
        </SheetContent>
      </Sheet>
    </Card>
  );
}
