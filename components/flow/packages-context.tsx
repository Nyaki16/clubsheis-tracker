"use client";

import { createContext, useContext } from "react";
import { PACKAGES, setKnownPackages, type PackageDef } from "@/lib/flow";

const Ctx = createContext<PackageDef[]>(PACKAGES);

export function PackagesProvider({ packages, children }: { packages: PackageDef[]; children: React.ReactNode }) {
  setKnownPackages(packages);
  return <Ctx.Provider value={packages}>{children}</Ctx.Provider>;
}

export const usePackages = () => useContext(Ctx);
