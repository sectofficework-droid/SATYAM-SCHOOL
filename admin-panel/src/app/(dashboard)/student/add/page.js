"use client";

import { useRouter } from "next/navigation";
import AddStudentForm from "@/components/AddStudentForm";

export default function AddStudentPage() {
  const router = useRouter();

  return (
    <AddStudentForm
      variant="page"
      onCancel={() => router.back()}
      onSaved={() => router.push("/student")}
    />
  );
}
