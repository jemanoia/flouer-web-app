import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { SalePaymentStatus, SalesRecord, SalesRecordItem } from "@/types/sales";
import { supabase } from "@/utils/supabase";

type DbSalesRecordItemRow = {
  id: number;
  sales_record_id: number;
  product_id: string;
  quantity: number | string;
  unit_price: number | string;
  line_total: number | string;
};

type DbLegacyLineItemRow = {
  id?: string;
  flavor?: string;
  price?: number;
  quantity?: number;
  lineTotal?: number;
};

type DbSalesRecordRow = {
  id: number;
  invoice_number: string;
  invoice_created_at: string;
  checkout_subtotal: number | string;
  payment_status: SalePaymentStatus | null;
  customer_first_name: string | null;
  customer_middle_name: string | null;
  customer_last_name: string | null;
  receipt_file_path: string | null;
  receipt_uploaded_by: "user" | "owner" | null;
  created_at: string;
  line_items: unknown;
};

type DbProductNameRow = {
  id: string;
  name: string;
};

const toNumeric = (value: number | string | null | undefined): number => {
  const parsed = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNullableTrimmedText = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseLegacyLineItems = (lineItems: unknown): DbLegacyLineItemRow[] => {
  if (!Array.isArray(lineItems)) {
    return [];
  }

  return lineItems.filter(
    (item): item is DbLegacyLineItemRow => !!item && typeof item === "object"
  );
};

const mapSalesRecordRow = (
  row: DbSalesRecordRow,
  normalizedItemsByRecordId: Map<number, SalesRecordItem[]>
): SalesRecord => {
  const legacyLineItems = parseLegacyLineItems(row.line_items);
  const normalizedItems = normalizedItemsByRecordId.get(row.id) ?? [];

  const fallbackLegacyItems =
    normalizedItems.length > 0
      ? []
      : legacyLineItems.map<SalesRecordItem>((item, index) => {
          const productId =
            typeof item.id === "string" && item.id.trim().length > 0
              ? item.id.trim()
              : `legacy-item-${index + 1}`;
          const productName =
            typeof item.flavor === "string" && item.flavor.trim().length > 0
              ? item.flavor.trim()
              : productId;
          const quantity =
            typeof item.quantity === "number" && Number.isFinite(item.quantity)
              ? item.quantity
              : 0;
          const unitPrice =
            typeof item.price === "number" && Number.isFinite(item.price) ? item.price : 0;
          const lineTotal =
            typeof item.lineTotal === "number" && Number.isFinite(item.lineTotal)
              ? item.lineTotal
              : unitPrice * quantity;

          return {
            id: index + 1,
            productId,
            productName,
            quantity,
            unitPrice,
            lineTotal,
          };
        });

  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    invoiceCreatedAt: row.invoice_created_at,
    checkoutSubtotal: toNumeric(row.checkout_subtotal),
    paymentStatus: row.payment_status ?? "pending_verification",
    customerFirstName: toNullableTrimmedText(row.customer_first_name),
    customerMiddleName: toNullableTrimmedText(row.customer_middle_name),
    customerLastName: toNullableTrimmedText(row.customer_last_name),
    receiptFilePath: toNullableTrimmedText(row.receipt_file_path),
    receiptUploadedBy: row.receipt_uploaded_by,
    createdAt: row.created_at,
    items: normalizedItems.length > 0 ? normalizedItems : fallbackLegacyItems,
  };
};

export function useSalesCheckoutState(session: Session | null) {
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [selectedSalesRecordId, setSelectedSalesRecordId] = useState<number | null>(null);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [isRefreshingRecords, setIsRefreshingRecords] = useState(false);
  const [isUpdatingPaymentStatus, setIsUpdatingPaymentStatus] = useState(false);
  const [paymentStatusActionErrorMessage, setPaymentStatusActionErrorMessage] = useState("");
  const [salesErrorMessage, setSalesErrorMessage] = useState("");

  const fetchSalesRecords = useCallback(
    async (options?: { refresh?: boolean }) => {
      if (!session) {
        setSalesRecords([]);
        setSelectedSalesRecordId(null);
        setIsLoadingRecords(false);
        setIsRefreshingRecords(false);
        setSalesErrorMessage("");
        return;
      }

      const isRefresh = options?.refresh ?? false;
      if (isRefresh) {
        setIsRefreshingRecords(true);
      } else {
        setIsLoadingRecords(true);
      }
      setSalesErrorMessage("");

      const primarySelect =
        "id, invoice_number, invoice_created_at, checkout_subtotal, payment_status, customer_first_name, customer_middle_name, customer_last_name, receipt_file_path, receipt_uploaded_by, created_at, line_items";
      const fallbackSelect =
        "id, invoice_number, invoice_created_at, checkout_subtotal, payment_status, created_at, line_items";

      let { data, error } = await supabase
        .from("sales_records")
        .select(primarySelect)
        .order("created_at", { ascending: false })
        .limit(100)
        .returns<DbSalesRecordRow[]>();

      if (error && error.code === "42703") {
        const fallbackResponse = await supabase
          .from("sales_records")
          .select(fallbackSelect)
          .order("created_at", { ascending: false })
          .limit(100)
          .returns<
            Array<
              Omit<
                DbSalesRecordRow,
                | "customer_first_name"
                | "customer_middle_name"
                | "customer_last_name"
                | "receipt_file_path"
                | "receipt_uploaded_by"
              >
            >
          >();

        if (!fallbackResponse.error) {
          data = (fallbackResponse.data ?? []).map((row) => ({
            ...row,
            customer_first_name: null,
            customer_middle_name: null,
            customer_last_name: null,
            receipt_file_path: null,
            receipt_uploaded_by: null,
          }));
        }

        error = fallbackResponse.error;
      }

      if (error) {
        setSalesErrorMessage(
          `Unable to load sales records. ${error.message}${error.code ? ` (code: ${error.code})` : ""}`
        );
        setSalesRecords([]);
        setSelectedSalesRecordId(null);
      } else {
        const salesRows = data ?? [];
        const recordIds = salesRows.map((row) => row.id);

        let normalizedItemsByRecordId = new Map<number, SalesRecordItem[]>();
        if (recordIds.length > 0) {
          const { data: itemRows, error: itemError } = await supabase
            .from("sales_record_items")
            .select("id, sales_record_id, product_id, quantity, unit_price, line_total")
            .in("sales_record_id", recordIds)
            .returns<DbSalesRecordItemRow[]>();

          if (!itemError && itemRows && itemRows.length > 0) {
            const distinctProductIds = Array.from(
              new Set(itemRows.map((row) => row.product_id).filter((value) => value.length > 0))
            );
            let productNameById = new Map<string, string>();

            if (distinctProductIds.length > 0) {
              const { data: productRows, error: productError } = await supabase
                .from("products")
                .select("id, name")
                .in("id", distinctProductIds)
                .returns<DbProductNameRow[]>();

              if (!productError) {
                productNameById = new Map(
                  (productRows ?? []).map((row) => [row.id, row.name])
                );
              }
            }

            normalizedItemsByRecordId = itemRows.reduce((grouped, item) => {
              const current = grouped.get(item.sales_record_id) ?? [];
              current.push({
                id: item.id,
                productId: item.product_id,
                productName: productNameById.get(item.product_id) ?? item.product_id,
                quantity: toNumeric(item.quantity),
                unitPrice: toNumeric(item.unit_price),
                lineTotal: toNumeric(item.line_total),
              });
              grouped.set(item.sales_record_id, current);
              return grouped;
            }, new Map<number, SalesRecordItem[]>());
          }
        }

        const mappedRows = salesRows.map((row) =>
          mapSalesRecordRow(row, normalizedItemsByRecordId)
        );
        setSalesRecords(mappedRows);
        setSelectedSalesRecordId((previous) => {
          if (previous && mappedRows.some((record) => record.id === previous)) {
            return previous;
          }
          return mappedRows[0]?.id ?? null;
        });
      }

      if (isRefresh) {
        setIsRefreshingRecords(false);
      } else {
        setIsLoadingRecords(false);
      }
    },
    [session]
  );

  useEffect(() => {
    void fetchSalesRecords();
  }, [fetchSalesRecords]);

  const selectedSalesRecord = useMemo(
    () => salesRecords.find((record) => record.id === selectedSalesRecordId) ?? null,
    [salesRecords, selectedSalesRecordId]
  );

  const totalSalesValue = useMemo(
    () => salesRecords.reduce((sum, record) => sum + record.checkoutSubtotal, 0),
    [salesRecords]
  );

  const totalItemsSold = useMemo(
    () =>
      salesRecords.reduce(
        (sum, record) =>
          sum +
          record.items.reduce((recordItemTotal, item) => recordItemTotal + item.quantity, 0),
        0
      ),
    [salesRecords]
  );

  const updateRecordPaymentStatus = useCallback(
    async (
      recordId: number,
      nextStatus: SalePaymentStatus,
      options?: { receiptFilePath?: string | null; receiptUploadedBy?: "user" | "owner" | null }
    ): Promise<boolean> => {
      if (!session) {
        setPaymentStatusActionErrorMessage("You must be signed in to update payment status.");
        return false;
      }

      setIsUpdatingPaymentStatus(true);
      setPaymentStatusActionErrorMessage("");

      const normalizedReceiptPath = options?.receiptFilePath?.trim() ?? "";
      if (nextStatus === "paid_verified" && normalizedReceiptPath.length === 0) {
        setPaymentStatusActionErrorMessage(
          "Cannot complete order: a receipt must be uploaded before marking as paid."
        );
        setIsUpdatingPaymentStatus(false);
        return false;
      }

      const updatePayload: {
        payment_status: SalePaymentStatus;
        receipt_file_path?: string;
        receipt_uploaded_by?: "user" | "owner";
        payment_verified_at?: string;
        payment_verified_by?: string;
      } = { payment_status: nextStatus };

      if (nextStatus === "paid_verified") {
        updatePayload.receipt_file_path = normalizedReceiptPath;
        updatePayload.receipt_uploaded_by = options?.receiptUploadedBy ?? "owner";
        updatePayload.payment_verified_at = new Date().toISOString();
        updatePayload.payment_verified_by = session.user.id;
      }

      const { error } = await supabase
        .from("sales_records")
        .update(updatePayload)
        .eq("id", recordId);

      if (error) {
        setPaymentStatusActionErrorMessage(
          `Unable to update payment status. ${error.message}${error.code ? ` (code: ${error.code})` : ""}`
        );
        setIsUpdatingPaymentStatus(false);
        return false;
      }

      setSalesRecords((previous) =>
        previous.map((record) =>
          record.id === recordId
            ? {
                ...record,
                paymentStatus: nextStatus,
                receiptFilePath:
                  nextStatus === "paid_verified"
                    ? updatePayload.receipt_file_path ?? record.receiptFilePath
                    : record.receiptFilePath,
                receiptUploadedBy:
                  nextStatus === "paid_verified"
                    ? updatePayload.receipt_uploaded_by ?? record.receiptUploadedBy
                    : record.receiptUploadedBy,
              }
            : record
        )
      );
      setIsUpdatingPaymentStatus(false);
      return true;
    },
    [session]
  );

  return {
    salesRecords,
    selectedSalesRecordId,
    setSelectedSalesRecordId,
    selectedSalesRecord,
    isLoadingRecords,
    isRefreshingRecords,
    salesErrorMessage,
    isUpdatingPaymentStatus,
    paymentStatusActionErrorMessage,
    totalSalesValue,
    totalItemsSold,
    fetchSalesRecords,
    updateRecordPaymentStatus,
  };
}
