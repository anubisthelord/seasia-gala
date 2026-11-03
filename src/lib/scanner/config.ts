
export const SCANNER_CONFIG = {
    FPS: 10,
    QR_BOX: {
      width: 250,
      height: 250,
    },
    REQUEST_TIMEOUT: 10000,
    SUCCESS_RESET_DELAY: 0,
  } as const;
  
  export const SCANNER_MESSAGES = {
    CAMERA_PERMISSION:
      "Camera permission is required. Please allow camera access in your browser settings.",
    CAMERA_UNAVAILABLE:
      "Camera is unavailable. Check that another application is not using it.",
    SERVER_UNAVAILABLE:
      "Unable to connect to the event server. Check your internet connection.",
    INVALID_QR:
      "This QR code is not recognized.",
    SCAN_CONFLICT:
      "This scan could not be completed. Please scan again.",
  } as const;
  