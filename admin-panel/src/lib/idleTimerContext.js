"use client";

import { createContext, useContext } from "react";

// Seconds remaining before AuthGuard's inactivity timer signs the admin out.
// Provided by AuthGuard, read by Header to show a live countdown.
export const IdleTimerContext = createContext(900);
export const useIdleTimer = () => useContext(IdleTimerContext);
