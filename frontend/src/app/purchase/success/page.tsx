import { Suspense } from "react";
import PurchaseSuccessClient from "./PurchaseSuccessClient";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PurchaseSuccessClient />
    </Suspense>
  );
}