"use client";

import { createContext, useContext } from "react";

// Seconds remaining before AuthGuard's inactivity timer signs the admin out.
// Provided by AuthGuard, read by Header to show a live countdown.
export const IdleTimerContext = createContext(600);
export const useIdleTimer = () => useContext(IdleTimerContext);
