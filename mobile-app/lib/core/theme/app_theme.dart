import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  static const navy      = Color(0xFF1E3A5F);
  static const navyDark  = Color(0xFF0F2340);
  static const navyMid   = Color(0xFF254A78);
  static const amber     = Color(0xFFF59E0B);
  static const amberLight= Color(0xFFFEF3C7);
  static const green     = Color(0xFF10B981);
  static const greenLight= Color(0xFFD1FAE5);
  static const red       = Color(0xFFEF4444);
  static const redLight  = Color(0xFFFEE2E2);
  static const blue      = Color(0xFF3B82F6);
  static const blueLight = Color(0xFFDBEAFE);
  static const purple    = Color(0xFF8B5CF6);
  static const purpleLight = Color(0xFFEDE9FE);
  static const pink      = Color(0xFFEC4899);
  static const pinkLight = Color(0xFFFCE7F3);
  static const teal      = Color(0xFF14B8A6);
  static const tealLight = Color(0xFFCCFBF1);
  static const indigo    = Color(0xFF6366F1);
  static const indigoLight = Color(0xFFE0E7FF);
  static const bg        = Color(0xFFF0F4FF);
  static const card      = Color(0xFFFFFFFF);
  static const border    = Color(0xFFE2E8F0);
  static const text      = Color(0xFF1E293B);
  static const textLight = Color(0xFF64748B);
  static const textHint  = Color(0xFF94A3B8);

  // Gradients
  static const navyGradient = LinearGradient(
    colors: [navyMid, navyDark],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}

class AppShadows {
  static const card = [
    BoxShadow(color: Color(0x0A000000), blurRadius: 8, offset: Offset(0, 2)),
    BoxShadow(color: Color(0x06000000), blurRadius: 24, offset: Offset(0, 8)),
  ];
  static const colored = [
    BoxShadow(color: Color(0x20000000), blurRadius: 16, offset: Offset(0, 6)),
  ];
  static const nav = [
    BoxShadow(color: Color(0x12000000), blurRadius: 24, offset: Offset(0, -4)),
  ];
}

class AppTheme {
  static ThemeData get light => ThemeData(
    useMaterial3: true,
    textTheme: GoogleFonts.poppinsTextTheme(),
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.navy,
      primary: AppColors.navy,
      secondary: AppColors.amber,
      surface: AppColors.card,
      background: AppColors.bg,
    ),
    scaffoldBackgroundColor: AppColors.bg,
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      foregroundColor: Colors.white,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontSize: 17,
        fontWeight: FontWeight.w600,
        color: Colors.white,
        fontFamily: 'Poppins',
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.navy,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        elevation: 0,
        textStyle: const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w600,
          fontFamily: 'Poppins',
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.card,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.navy, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.red),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      hintStyle: const TextStyle(color: AppColors.textHint, fontSize: 14),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: AppColors.card,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.border),
      ),
      margin: EdgeInsets.zero,
    ),
  );
}
