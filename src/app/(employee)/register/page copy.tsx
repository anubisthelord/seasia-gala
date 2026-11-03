"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
    ArrowRight,
    ArrowLeft,
    Mail,
    UserRound,
    Phone,
    BriefcaseBusiness,
    CheckCircle2,
    Loader2,
    Users,
    User,
    Sparkles,
} from "lucide-react";

interface EmployeeForm {
    fullName: string;
    officialEmail: string;
    phoneNumber: string;
    employeeId: string;
}

type RegistrationStep =
    | "details"
    | "otp"
    | "verified"
    | "attendance"
    | "partner"
    | "review"
    | "success";

type AttendanceType = "SINGLE" | "COUPLE";
type PartnerTitle = "MR" | "MRS" | "FIANCE" | "FIANCEE";

interface ApiResponse {
    success: boolean;
    verified?: boolean;
    message?: string;
    expiresIn?: number;
    resendAfter?: number;
    remainingSeconds?: number;
    remainingAttempts?: number;
}

export default function EmployeeRegistrationPage() {
    const [form, setForm] = useState<EmployeeForm>({
        fullName: "",
        officialEmail: "",
        phoneNumber: "",
        employeeId: "",
    });

    const [errors, setErrors] = useState<Partial<EmployeeForm>>({});
    const [step, setStep] = useState<RegistrationStep>("details");

    const [otp, setOtp] = useState("");
    const [message, setMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    const [isSending, setIsSending] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [resendCountdown, setResendCountdown] = useState(0);

    const [attendanceType, setAttendanceType] = useState<AttendanceType | null>(null);

    const [partnerDetails, setPartnerDetails] = useState({
        title: "" as PartnerTitle | "",
        fullName: "",
    });

    const [partnerDocument, setPartnerDocument] = useState<File | null>(null);

    const [partnerErrors, setPartnerErrors] = useState<{
        title?: string;
        fullName?: string;
        document?: string;
    }>({});

    useEffect(() => {
        if (resendCountdown <= 0) return;

        const timer = setInterval(() => {
            setResendCountdown((current) => Math.max(0, current - 1));
        }, 1000);

        return () => clearInterval(timer);
    }, [resendCountdown]);

    function updateField(field: keyof EmployeeForm, value: string) {
        setForm((previous) => ({
            ...previous,
            [field]: value,
        }));

        setErrors((previous) => ({
            ...previous,
            [field]: "",
        }));

        setErrorMessage("");
    }

    function validateForm() {
        const newErrors: Partial<EmployeeForm> = {};

        if (!form.fullName.trim()) {
            newErrors.fullName = "Full name is required";
        } else if (form.fullName.trim().length < 2) {
            newErrors.fullName = "Enter a valid full name";
        }

        const email = form.officialEmail.trim().toLowerCase();

        if (!email) {
            newErrors.officialEmail = "Official email is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            newErrors.officialEmail = "Enter a valid email address";
        }

        if (!form.phoneNumber) {
            newErrors.phoneNumber = "Mobile number is required";
        } else if (!/^[6-9]\d{9}$/.test(form.phoneNumber)) {
            newErrors.phoneNumber = "Enter a valid 10-digit Indian mobile number";
        }

        if (!form.employeeId.trim()) {
            newErrors.employeeId = "Employee ID is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    async function handleReviewConfirm() {
        setErrorMessage("");
        setMessage("");

        if (attendanceType === "COUPLE" && !partnerDocument) {
            setErrorMessage("Please upload your partner's identity document.");
            return;
        }

        setIsSubmitting(true);

        try {
            const submissionData = new FormData();
            submissionData.append("attendanceType", attendanceType as string);

            if (attendanceType === "COUPLE") {
                submissionData.append("partnerFullName", partnerDetails.fullName.trim());
                submissionData.append("partnerTitle", partnerDetails.title);
                submissionData.append("partnerDocument", partnerDocument as File);
            }

            const response = await fetch("/api/employee/register", {
                method: "POST",
                body: submissionData,
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                setErrorMessage(data.message || "Unable to submit your registration.");
                return;
            }

            setStep("success");
            setMessage(
                data.message ||
                    "Your registration has been submitted successfully and is pending admin approval."
            );
        } catch {
            setErrorMessage("Unable to connect to the server. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleSendOtp() {
        if (!validateForm()) return;

        setIsSending(true);
        setErrorMessage("");
        setMessage("");

        try {
            const response = await fetch("/api/employee/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    officialEmail: form.officialEmail.trim().toLowerCase(),
                }),
            });

            const data: ApiResponse = await response.json();

            if (!response.ok || !data.success) {
                setErrorMessage(data.message || "Unable to send verification code.");
                if (data.remainingSeconds) setResendCountdown(data.remainingSeconds);
                return;
            }

            if (data.message?.toLowerCase().includes("already been verified")) {
                setStep("verified");
                setMessage("Your official email has already been verified.");
                return;
            }

            setOtp("");
            setStep("otp");
            setResendCountdown(data.resendAfter ?? 60);
            setMessage("Verification code sent to your official email.");
        } catch {
            setErrorMessage("Unable to connect to the server. Please try again.");
        } finally {
            setIsSending(false);
        }
    }

    async function handleVerifyOtp() {
        if (!/^\d{6}$/.test(otp)) {
            setErrorMessage("Please enter a valid 6-digit verification code.");
            return;
        }

        setIsVerifying(true);
        setErrorMessage("");
        setMessage("");

        try {
            const response = await fetch("/api/employee/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fullName: form.fullName.trim(),
                    officialEmail: form.officialEmail.trim().toLowerCase(),
                    phoneNumber: form.phoneNumber.trim(),
                    employeeId: form.employeeId.trim(),
                    otp,
                }),
            });

            const data: ApiResponse = await response.json();

            if (!response.ok || !data.success || !data.verified) {
                setErrorMessage(data.message || "Unable to verify your email.");
                return;
            }

            setStep("verified");
            setMessage("Your email has been verified and employee details have been saved successfully.");
        } catch {
            setErrorMessage("Unable to connect to the server. Please try again.");
        } finally {
            setIsVerifying(false);
        }
    }

    async function handleResendOtp() {
        if (resendCountdown > 0 || isSending) return;

        setIsSending(true);
        setErrorMessage("");
        setMessage("");

        try {
            const response = await fetch("/api/employee/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    officialEmail: form.officialEmail.trim().toLowerCase(),
                }),
            });

            const data: ApiResponse = await response.json();

            if (!response.ok || !data.success) {
                setErrorMessage(data.message || "Unable to resend verification code.");
                if (data.remainingSeconds) setResendCountdown(data.remainingSeconds);
                return;
            }

            if (data.message?.toLowerCase().includes("already been verified")) {
                setStep("verified");
                setMessage("Your official email has already been verified.");
                return;
            }

            setOtp("");
            setResendCountdown(data.resendAfter ?? 60);
            setMessage("A new verification code has been sent.");
        } catch {
            setErrorMessage("Unable to connect to the server. Please try again.");
        } finally {
            setIsSending(false);
        }
    }

    function handleContinueToAttendance() {
        setMessage("");
        setErrorMessage("");
        setStep("attendance");
    }

    function handleAttendanceContinue() {
        if (!attendanceType) {
            setErrorMessage("Please select your attendance type.");
            return;
        }

        setErrorMessage("");
        setMessage("");

        if (attendanceType === "COUPLE") {
            setStep("partner");
            return;
        }

        setStep("review");
    }

    function handlePartnerContinue() {
        const newErrors: typeof partnerErrors = {};

        if (!partnerDetails.title) {
            newErrors.title = "Please select your partner's title.";
        }

        if (!partnerDetails.fullName.trim()) {
            newErrors.fullName = "Partner's full name is required.";
        } else if (partnerDetails.fullName.trim().length < 2) {
            newErrors.fullName = "Enter a valid full name.";
        }

        if (!partnerDocument) {
            newErrors.document = "Please attach the verification document.";
        } else {
            const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
            if (!allowedTypes.includes(partnerDocument.type)) {
                newErrors.document = "Only JPG, PNG or WEBP images are allowed.";
            } else if (partnerDocument.size > 5 * 1024 * 1024) {
                newErrors.document = "Document size must be less than 5 MB.";
            }
        }

        setPartnerErrors(newErrors);

        if (Object.keys(newErrors).length > 0) return;

        setMessage("");
        setErrorMessage("");
        setStep("review");
    }

    const fields = [
        {
            name: "fullName" as const,
            label: "Full Name",
            placeholder: "Enter your full name",
            icon: UserRound,
            type: "text",
        },
        {
            name: "officialEmail" as const,
            label: "Official Company Email",
            placeholder: "name@company.com",
            icon: Mail,
            type: "email",
        },
        {
            name: "phoneNumber" as const,
            label: "Indian Mobile Number",
            placeholder: "Enter 10-digit mobile number",
            icon: Phone,
            type: "tel",
        },
        {
            name: "employeeId" as const,
            label: "Employee ID",
            placeholder: "Enter your employee ID",
            icon: BriefcaseBusiness,
            type: "text",
        },
    ];

    const progressStep =
        step === "details"
            ? 1
            : step === "otp" || step === "verified"
                ? 2
                : step === "attendance"
                    ? 3
                    : step === "partner"
                        ? 4
                        : 5;

    const progressWidth =
        progressStep === 1
            ? "w-1/5"
            : progressStep === 2
                ? "w-2/5"
                : progressStep === 3
                    ? "w-3/5"
                    : progressStep === 4
                        ? "w-4/5"
                        : "w-full";

    return (
        <main
        className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cover bg-center bg-no-repeat px-4 py-10"
        style={{
            backgroundImage: "url('/background/bgdemo (3).jpg')",
        }}
    >
        {/* Background overlay */}
        {/* <div className="absolute inset-0 bg-gradient-to-br from-purple-50/85 via-white/80 to-violet-50/85" /> */}
    
        {/* Main Content */}
        <div className="relative z-10 w-full max-w-xl">

      
                {/* Brand mark */}
                <div className="mb-6 text-center">
                    <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-purple-700 text-white shadow-sm shadow-purple-700/20">
                        <Sparkles size={22} />
                    </div>

                    <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                        Seaise Gala Event
                    </h1>

                    <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-purple-600">
                        Event Registration Portal
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                        {step === "details"
                            ? "Enter your employee details to begin your event registration."
                            : step === "otp"
                                ? "Verify your official company email to continue registration."
                                : step === "verified"
                                    ? "Your official email address has been successfully verified."
                                    : step === "attendance"
                                        ? "Choose how you will be attending the gala event."
                                        : step === "partner"
                                            ? "Enter your spouse or partner's details for the gala event."
                                            : step === "review"
                                                ? "Review your information before final submission."
                                                : "Your registration is complete."}
                    </p>
                </div>

                {/* Progress Bar - Hidden on Success */}
                {step !== "success" && (
                    <div className="mb-6">
                        <div className="mb-3 flex items-center justify-between text-xs font-medium">
                            <span className="text-slate-900">Step {progressStep} of 5</span>
                            <span className="text-slate-500">
                                {step === "details"
                                    ? "Employee Details"
                                    : step === "otp"
                                        ? "Email Verification"
                                        : step === "verified"
                                            ? "Email Verified"
                                            : step === "attendance"
                                                ? "Attendance Selection"
                                                : step === "partner"
                                                    ? "Partner Details"
                                                    : "Registration Review"}
                            </span>
                        </div>

                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                            <div
                                className={`h-full rounded-full bg-purple-600 transition-all duration-300 ${progressWidth}`}
                            />
                        </div>
                    </div>
                )}

                {/* Main Card */}
                <div className="rounded-md border border-purple-100 bg-white p-5 shadow-sm shadow-purple-900/5 sm:p-6">
                    {/* STEP 1: Employee Details */}
                    {step === "details" && (
                        <>
                            <div className="mb-4">
                                <h2 className="text-sm font-semibold text-slate-900">Your Details</h2>
                                <p className="mt-0.5 text-xs text-slate-500">All fields are required.</p>
                            </div>

                            <div className="space-y-3.5">
                                {fields.map((field) => {
                                    const Icon = field.icon;

                                    return (
                                        <div key={field.name}>
                                            <label
                                                htmlFor={field.name}
                                                className="mb-1 block text-xs font-semibold text-slate-700"
                                            >
                                                {field.label}
                                                <span className="ml-0.5 text-red-500">*</span>
                                            </label>

                                            <div className="relative">
                                                <Icon
                                                    size={14}
                                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400"
                                                />
                                                <input
                                                    id={field.name}
                                                    type={field.type}
                                                    value={form[field.name]}
                                                    onChange={(event) => {
                                                        let value = event.target.value;
                                                        if (field.name === "phoneNumber") {
                                                            value = value.replace(/\D/g, "").slice(0, 10);
                                                        }
                                                        updateField(field.name, value);
                                                    }}
                                                    placeholder={field.placeholder}
                                                    maxLength={field.name === "phoneNumber" ? 10 : undefined}
                                                    inputMode={field.name === "phoneNumber" ? "numeric" : undefined}
                                                    autoComplete={
                                                        field.name === "fullName"
                                                            ? "name"
                                                            : field.name === "officialEmail"
                                                                ? "email"
                                                                : field.name === "phoneNumber"
                                                                    ? "tel"
                                                                    : "off"
                                                    }
                                                    className={`h-9 w-full rounded-md border bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 ${
                                                        errors[field.name]
                                                            ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                                                            : "border-slate-200 focus:border-purple-500 focus:ring-purple-100"
                                                    }`}
                                                />
                                            </div>

                                            {errors[field.name] && (
                                                <p className="mt-1 text-xs text-red-600">{errors[field.name]}</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {errorMessage && (
                                <div
                                    role="alert"
                                    className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
                                >
                                    {errorMessage}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleSendOtp}
                                disabled={isSending}
                                className="mt-5 flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-purple-700 text-sm font-medium text-white shadow-sm shadow-purple-700/20 transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSending ? (
                                    <>
                                        <Loader2 size={15} className="animate-spin" />
                                        Sending verification code...
                                    </>
                                ) : (
                                    <>
                                        Continue
                                        <ArrowRight size={15} />
                                    </>
                                )}
                            </button>
                        </>
                    )}

                    {/* STEP 2: OTP Verification */}
                    {step === "otp" && (
                        <>
                            <button
                                type="button"
                                onClick={() => {
                                    setStep("details");
                                    setOtp("");
                                    setMessage("");
                                    setErrorMessage("");
                                }}
                                className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-purple-700"
                            >
                                <ArrowLeft size={14} />
                                Back to details
                            </button>

                            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-purple-50 text-purple-700">
                                <Mail size={18} />
                            </div>

                            <h2 className="text-sm font-semibold text-slate-900">Verify your email</h2>
                            <p className="mt-1 text-xs text-slate-500">
                                We've sent a six-digit verification code to:
                            </p>
                            <p className="mt-0.5 break-all text-sm font-semibold text-slate-900">
                                {form.officialEmail.trim().toLowerCase()}
                            </p>

                            <div className="mt-5">
                                <label htmlFor="otp" className="mb-1 block text-xs font-semibold text-slate-700">
                                    Verification Code
                                </label>
                                <input
                                    id="otp"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    maxLength={6}
                                    value={otp}
                                    onChange={(event) => {
                                        setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                                        setErrorMessage("");
                                    }}
                                    placeholder="Enter 6-digit code"
                                    className="h-12 w-full rounded-md border border-slate-200 bg-white px-4 text-center text-lg font-semibold tracking-[0.5em] text-slate-900 outline-none placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                                />
                            </div>

                            {message && <p className="mt-3 text-xs font-medium text-emerald-700">{message}</p>}
                            {errorMessage && (
                                <div
                                    role="alert"
                                    className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
                                >
                                    {errorMessage}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleVerifyOtp}
                                disabled={isVerifying || otp.length !== 6}
                                className="mt-5 flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-purple-700 text-sm font-medium text-white shadow-sm shadow-purple-700/20 transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isVerifying ? (
                                    <>
                                        <Loader2 size={15} className="animate-spin" />
                                        Verifying...
                                    </>
                                ) : (
                                    <>
                                        Verify Email
                                        <ArrowRight size={15} />
                                    </>
                                )}
                            </button>

                            <div className="mt-5 text-center">
                                <p className="text-xs text-slate-500">Didn't receive the code?</p>
                                <button
                                    type="button"
                                    onClick={handleResendOtp}
                                    disabled={resendCountdown > 0 || isSending}
                                    className="mt-1 text-xs font-semibold text-purple-700 transition hover:text-purple-800 disabled:cursor-not-allowed disabled:text-slate-400"
                                >
                                    {isSending
                                        ? "Sending..."
                                        : resendCountdown > 0
                                            ? `Resend code in ${resendCountdown}s`
                                            : "Resend verification code"}
                                </button>
                            </div>

                            <p className="mt-4 text-center text-[11px] text-slate-400">
                                Your verification code expires in 5 minutes.
                            </p>
                        </>
                    )}

                    {/* EMAIL VERIFIED */}
                    {step === "verified" && (
                        <div className="py-4 text-center">
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                                <CheckCircle2 size={28} />
                            </div>

                            <h2 className="text-base font-semibold text-slate-900">
                                Email Verified Successfully
                            </h2>
                            <p className="mt-2 text-sm text-slate-500">
                                Your official company email has been verified. You can now continue with
                                your event registration.
                            </p>

                            <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-3 text-left">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                    Verified Email
                                </p>
                                <p className="mt-0.5 break-all text-sm font-semibold text-slate-900">
                                    {form.officialEmail.trim().toLowerCase()}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={handleContinueToAttendance}
                                className="mt-6 flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-purple-700 text-sm font-medium text-white shadow-sm shadow-purple-700/20 transition hover:bg-purple-800"
                            >
                                Continue to Attendance
                                <ArrowRight size={15} />
                            </button>
                        </div>
                    )}

                    {/* STEP 3: ATTENDANCE SELECTION */}
                    {step === "attendance" && (
                        <>
                            <button
                                type="button"
                                onClick={() => setStep("verified")}
                                className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-purple-700"
                            >
                                <ArrowLeft size={14} />
                                Back
                            </button>

                            <div className="mb-5">
                                <h2 className="text-sm font-semibold text-slate-900">
                                    How will you be attending?
                                </h2>
                                <p className="mt-1 text-xs text-slate-500">
                                    Select the registration type that applies to you.
                                </p>
                            </div>

                            <div className="space-y-3">
                                {/* SINGLE OPTION */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAttendanceType("SINGLE");
                                        setErrorMessage("");
                                        setMessage("");
                                    }}
                                    className={`w-full rounded-md border p-4 text-left transition ${
                                        attendanceType === "SINGLE"
                                            ? "border-purple-600 bg-purple-50 ring-1 ring-purple-600"
                                            : "border-slate-200 hover:border-purple-300 hover:bg-purple-50/30"
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${attendanceType === "SINGLE" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"}`}>
                                            <User size={18} />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-3">
                                                <h3 className="text-sm font-semibold text-slate-900">Single</h3>
                                                <span
                                                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                                        attendanceType === "SINGLE"
                                                            ? "border-purple-700 bg-purple-700"
                                                            : "border-slate-300"
                                                    }`}
                                                >
                                                    {attendanceType === "SINGLE" && (
                                                        <CheckCircle2 size={12} className="text-white" />
                                                    )}
                                                </span>
                                            </div>
                                            <p className="mt-0.5 text-xs text-slate-500">
                                                Registration for yourself only.
                                            </p>
                                            <p className="mt-2 text-[11px] font-semibold text-slate-700">
                                                1 Attendee
                                            </p>
                                        </div>
                                    </div>
                                </button>

                                {/* COUPLE OPTION */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAttendanceType("COUPLE");
                                        setErrorMessage("");
                                        setMessage("");
                                    }}
                                    className={`w-full rounded-md border p-4 text-left transition ${
                                        attendanceType === "COUPLE"
                                            ? "border-purple-600 bg-purple-50 ring-1 ring-purple-600"
                                            : "border-slate-200 hover:border-purple-300 hover:bg-purple-50/30"
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${attendanceType === "COUPLE" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"}`}>
                                            <Users size={18} />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-3">
                                                <h3 className="text-sm font-semibold text-slate-900">Couple</h3>
                                                <span
                                                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                                        attendanceType === "COUPLE"
                                                            ? "border-purple-700 bg-purple-700"
                                                            : "border-slate-300"
                                                    }`}
                                                >
                                                    {attendanceType === "COUPLE" && (
                                                        <CheckCircle2 size={12} className="text-white" />
                                                    )}
                                                </span>
                                            </div>
                                            <p className="mt-0.5 text-xs text-slate-500">
                                                Registration for yourself and your spouse or partner.
                                            </p>
                                            <p className="mt-2 text-[11px] font-semibold text-slate-700">
                                                2 Attendees
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            </div>

                            <p className="mt-4 text-[11px] leading-5 text-slate-500">
                                Children are not included in this event registration.
                            </p>

                            {errorMessage && (
                                <div
                                    role="alert"
                                    className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
                                >
                                    {errorMessage}
                                </div>
                            )}
                            {message && (
                                <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                                    {message}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleAttendanceContinue}
                                disabled={!attendanceType}
                                className="mt-6 flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-purple-700 text-sm font-medium text-white shadow-sm shadow-purple-700/20 transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Continue
                                <ArrowRight size={15} />
                            </button>
                        </>
                    )}

                    {/* STEP 4: PARTNER DETAILS */}
                    {step === "partner" && (
                        <>
                            <button
                                type="button"
                                onClick={() => {
                                    setStep("attendance");
                                    setMessage("");
                                    setErrorMessage("");
                                }}
                                className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-purple-700"
                            >
                                <ArrowLeft size={14} />
                                Back to attendance
                            </button>

                            <div className="mb-5">
                                <h2 className="text-sm font-semibold text-slate-900">Partner Details</h2>
                                <p className="mt-1 text-xs text-slate-500">
                                    Enter your spouse or partner's details for the gala event.
                                </p>
                            </div>

                            <div className="space-y-3.5">
                                {/* Partner Title */}
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                                        Title <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={partnerDetails.title}
                                        onChange={(event) => {
                                            setPartnerDetails((previous) => ({
                                                ...previous,
                                                title: event.target.value as PartnerTitle | "",
                                            }));
                                            setPartnerErrors((previous) => ({
                                                ...previous,
                                                title: "",
                                            }));
                                        }}
                                        className={`h-9 w-full rounded-md border bg-white px-3 text-sm text-slate-900 outline-none transition focus:ring-2 ${
                                            partnerErrors.title
                                                ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                                                : "border-slate-200 focus:border-purple-500 focus:ring-purple-100"
                                        }`}
                                    >
                                        <option value="">Select title</option>
                                        <option value="MR">Mr.</option>
                                        <option value="MRS">Mrs.</option>
                                        <option value="FIANCE">Fiancé</option>
                                        <option value="FIANCEE">Fiancée</option>
                                    </select>
                                    {partnerErrors.title && (
                                        <p className="mt-1 text-xs text-red-600">{partnerErrors.title}</p>
                                    )}
                                </div>

                                {/* Partner Name */}
                                <div>
                                    <label
                                        htmlFor="partnerName"
                                        className="mb-1 block text-xs font-semibold text-slate-700"
                                    >
                                        Partner's Full Name <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <UserRound
                                            size={14}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400"
                                        />
                                        <input
                                            id="partnerName"
                                            type="text"
                                            value={partnerDetails.fullName}
                                            onChange={(event) => {
                                                setPartnerDetails((previous) => ({
                                                    ...previous,
                                                    fullName: event.target.value,
                                                }));
                                                setPartnerErrors((previous) => ({
                                                    ...previous,
                                                    fullName: "",
                                                }));
                                            }}
                                            placeholder="Enter partner's full name"
                                            className={`h-9 w-full rounded-md border bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 ${
                                                partnerErrors.fullName
                                                    ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                                                    : "border-slate-200 focus:border-purple-500 focus:ring-purple-100"
                                            }`}
                                        />
                                    </div>
                                    {partnerErrors.fullName && (
                                        <p className="mt-1 text-xs text-red-600">{partnerErrors.fullName}</p>
                                    )}
                                </div>

                                {/* Document Upload */}
                                <div>
                                    <label
                                        htmlFor="partnerDocument"
                                        className="mb-1 block text-xs font-semibold text-slate-700"
                                    >
                                        Upload Identity Document <span className="text-red-500">*</span>
                                    </label>
                                    <label
                                        htmlFor="partnerDocument"
                                        className={`flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-slate-50 px-4 py-6 text-center transition hover:bg-purple-50/30 ${
                                            partnerErrors.document ? "border-red-400" : "border-slate-300 hover:border-purple-400"
                                        }`}
                                    >
                                        <BriefcaseBusiness size={20} className="mb-2 text-purple-500" />
                                        <span className="text-xs font-medium text-slate-800">
                                            {partnerDocument
                                                ? partnerDocument.name
                                                : "Choose a document image to upload"}
                                        </span>
                                        <span className="mt-1 text-[11px] text-slate-500">
                                            JPG, PNG or WEBP · Maximum 5 MB
                                        </span>
                                        <input
                                            id="partnerDocument"
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp"
                                            className="hidden"
                                            onChange={(event) => {
                                                const file = event.target.files?.[0];
                                                if (!file) return;

                                                const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

                                                if (!allowedTypes.includes(file.type)) {
                                                    setPartnerDocument(null);
                                                    setPartnerErrors((previous) => ({
                                                        ...previous,
                                                        document: "Only JPG, PNG and WEBP images are allowed.",
                                                    }));
                                                    event.target.value = "";
                                                    return;
                                                }

                                                if (file.size > 5 * 1024 * 1024) {
                                                    setPartnerDocument(null);
                                                    setPartnerErrors((previous) => ({
                                                        ...previous,
                                                        document: "Document image must be smaller than 5 MB.",
                                                    }));
                                                    event.target.value = "";
                                                    return;
                                                }

                                                setPartnerErrors((previous) => ({ ...previous, document: "" }));
                                                setPartnerDocument(file);
                                            }}
                                        />
                                    </label>
                                    {partnerErrors.document && (
                                        <p className="mt-1 text-xs text-red-600">{partnerErrors.document}</p>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4 rounded-md border border-purple-100 bg-purple-50/50 p-3">
                                <p className="text-[11px] leading-5 text-slate-600">
                                    Partner verification is a separate admin approval process. Your partner
                                    will receive a separate event pass only after the employee registration
                                    and partner document are approved.
                                </p>
                            </div>

                            {message && (
                                <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                                    {message}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handlePartnerContinue}
                                className="mt-5 flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-purple-700 text-sm font-medium text-white shadow-sm shadow-purple-700/20 transition hover:bg-purple-800"
                            >
                                Continue to Review
                                <ArrowRight size={15} />
                            </button>
                        </>
                    )}

                    {/* STEP 5: REGISTRATION REVIEW */}
                    {step === "review" && (
                        <>
                            <button
                                type="button"
                                onClick={() => {
                                    setMessage("");
                                    setErrorMessage("");
                                    setStep(attendanceType === "COUPLE" ? "partner" : "attendance");
                                }}
                                className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-purple-700"
                            >
                                <ArrowLeft size={14} />
                                Back to previous step
                            </button>

                            <div className="mb-5">
                                <h2 className="text-sm font-semibold text-slate-900">
                                    Review Your Registration
                                </h2>
                                <p className="mt-1 text-xs text-slate-500">
                                    Please check your information carefully before final submission.
                                </p>
                            </div>

                            {/* Employee Information */}
                            <div className="overflow-hidden rounded-md border border-slate-200">
                                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
                                    <h3 className="text-xs font-semibold text-slate-900">
                                        Employee Information
                                    </h3>
                                    <span className="text-[11px] font-semibold text-emerald-700">
                                        Email Verified
                                    </span>
                                </div>

                                <div className="space-y-3 p-3">
                                    <div>
                                        <p className="text-[11px] font-medium text-slate-500">Full Name</p>
                                        <p className="mt-0.5 text-sm font-medium text-slate-900">
                                            {form.fullName}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-medium text-slate-500">Official Email</p>
                                        <p className="mt-0.5 break-all text-sm font-medium text-slate-900">
                                            {form.officialEmail.trim().toLowerCase()}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-medium text-slate-500">Mobile Number</p>
                                        <p className="mt-0.5 text-sm font-medium text-slate-900">
                                            {form.phoneNumber}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-medium text-slate-500">Employee ID</p>
                                        <p className="mt-0.5 text-sm font-medium text-slate-900">
                                            {form.employeeId.toUpperCase()}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Attendance Information */}
                            <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
                                <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
                                    <h3 className="text-xs font-semibold text-slate-900">
                                        Attendance Information
                                    </h3>
                                </div>
                                <div className="flex items-center justify-between p-3">
                                    <div>
                                        <p className="text-sm font-medium text-slate-900">
                                            {attendanceType === "COUPLE" ? "Couple" : "Single"}
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-slate-500">
                                            {attendanceType === "COUPLE"
                                                ? "Employee and partner"
                                                : "Employee only"}
                                        </p>
                                    </div>
                                    <span className="text-sm font-semibold text-slate-900">
                                        {attendanceType === "COUPLE" ? "2 Attendees" : "1 Attendee"}
                                    </span>
                                </div>
                            </div>

                            {/* Partner Information - Couple Only */}
                            {attendanceType === "COUPLE" && (
                                <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
                                    <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
                                        <h3 className="text-xs font-semibold text-slate-900">
                                            Partner Information
                                        </h3>
                                    </div>
                                    <div className="space-y-3 p-3">
                                        <div>
                                            <p className="text-[11px] font-medium text-slate-500">Title</p>
                                            <p className="mt-0.5 text-sm font-medium text-slate-900">
                                                {{
                                                    MR: "Mr.",
                                                    MRS: "Mrs.",
                                                    FIANCE: "Fiancé",
                                                    FIANCEE: "Fiancée",
                                                }[partnerDetails.title as PartnerTitle] ?? "-"}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-medium text-slate-500">
                                                Partner's Full Name
                                            </p>
                                            <p className="mt-0.5 text-sm font-medium text-slate-900">
                                                {partnerDetails.fullName}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-medium text-slate-500">
                                                Uploaded Document
                                            </p>
                                            <p className="mt-0.5 break-all text-sm font-medium text-slate-900">
                                                {partnerDocument?.name ?? "No document selected"}
                                            </p>
                                        </div>
                                        <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5">
                                            <p className="text-[11px] leading-5 text-amber-800">
                                                Partner details and documents will be subject to separate admin
                                                verification.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Approval Information */}
                            <div className="mt-4 rounded-md border border-purple-100 bg-purple-50/50 p-3">
                                <h3 className="text-xs font-semibold text-slate-900">
                                    What happens next?
                                </h3>
                                <p className="mt-1 text-[11px] leading-5 text-slate-600">
                                    Your registration will be reviewed by the event administration team. Your
                                    event QR pass will be generated only after your employee registration is
                                    approved.
                                </p>
                                {attendanceType === "COUPLE" && (
                                    <p className="mt-1 text-[11px] leading-5 text-slate-600">
                                        Your partner's pass will be generated separately after their document
                                        verification is approved.
                                    </p>
                                )}
                            </div>

                            {message && (
                                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                    {message}
                                </div>
                            )}
                            {errorMessage && (
                                <div
                                    role="alert"
                                    className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
                                >
                                    {errorMessage}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleReviewConfirm}
                                disabled={isSubmitting}
                                className="mt-5 flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-purple-700 text-sm font-medium text-white shadow-sm shadow-purple-700/20 transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 size={15} className="animate-spin" />
                                        Submitting Registration...
                                    </>
                                ) : (
                                    <>
                                        Confirm Registration
                                        <CheckCircle2 size={15} />
                                    </>
                                )}
                            </button>

                            <p className="mt-2 text-center text-[11px] leading-5 text-slate-500">
                                By clicking confirm, you verify that all information is accurate.
                            </p>
                        </>
                    )}

                    {/* STEP 6: SUCCESS SCREEN */}
                    {step === "success" && (
                        <div className="py-6 text-center">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                                <CheckCircle2 size={32} />
                            </div>
                            <h2 className="text-lg font-semibold text-slate-900">
                                Registration Submitted!
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>

                            <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-3 text-left">
                                <p className="text-xs font-semibold text-slate-900">What's Next?</p>
                                <p className="mt-1 text-xs leading-5 text-slate-600">
                                    The event administration team will review your details. Once approved,
                                    your event QR code will be sent to your registered email address.
                                </p>
                            </div>
                        </div>
                    )}

                    {step !== "success" && (
                        <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">
                            Your information will only be used for event registration and verification.
                        </p>
                    )}
                </div>

               
            </div>
        </main>
    );
}