import React from "react";

export default function SeaiseGalaRegistration() {
    const inputClass =
        "w-full rounded-lg border border-rose-200 bg-white/95 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100";

    const labelClass =
        "mb-1.5 block text-[11px] font-semibold text-slate-700";

    return (
        <main className="flex min-h-screen w-full items-center justify-center bg-white px-4 py-12">

            {/* Invitation Card — centered */}
            <div
                className="relative w-full max-w-md overflow-hidden rounded-xl border border-rose-100 bg-cover bg-top bg-no-repeat shadow-xl shadow-rose-900/10"
                style={{
                    backgroundImage: "url('/background/icbg.jpg')",
                }}
            >
                {/* Top image area */}
                <div className="h-24" />

                {/* Form content */}
                <div className="relative z-10 p-6 sm:p-8">

                    {/* Header */}
                    <div className="mb-6 text-center">
                        <span className="text-sm font-bold uppercase  text-rose-600">
                            Seaise Gala Event
                        </span>

                        <h1 className="mt-1 font-serif text-xl font-medium tracking-tight text-slate-900">
                            Event Registration Portal
                        </h1>

                        <p className="mx-auto mt-1 max-w-xs text-center text-xs leading-5 text-slate-500">
                            Enter your employee details to begin your event registration.
                        </p>
                    </div>

                    {/* Section Heading with description */}
                    <div className="mb-4 border-l-2 border-rose-400 pl-3">
                        <h2 className="text-base font-semibold text-slate-900">
                            Your Details
                        </h2>
                       
                    </div>

                    {/* Form */}
                    <form className="space-y-4">

                        {/* Full Name */}
                        <div>
                            <label className={labelClass}>
                                Full Name <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="Enter your full name"
                                className={inputClass}
                            />
                        </div>

                        {/* Email */}
                        <div>
                            <label className={labelClass}>
                                Official Company Email <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="email"
                                required
                                placeholder="name@company.com"
                                className={inputClass}
                            />
                        </div>

                        {/* Phone */}
                        <div>
                            <label className={labelClass}>
                                Indian Mobile Number <span className="text-rose-500">*</span>
                            </label>

                            <div className="flex">
                                <span className="flex items-center rounded-l-lg border border-r-0 border-rose-200 bg-rose-50 px-3 text-sm font-medium text-slate-700">
                                    +91
                                </span>

                                <input
                                    type="tel"
                                    required
                                    placeholder="9876543210"
                                    className={`${inputClass} rounded-l-none`}
                                />
                            </div>
                        </div>

                        {/* Employee ID */}
                        <div>
                            <label className={labelClass}>
                                Employee ID <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. EMP12345"
                                className={inputClass}
                            />
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            className="mt-2 w-full rounded-lg bg-rose-400 px-4 py-3 text-sm font-semibold tracking-wide text-white shadow-md shadow-rose-400/30 transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:ring-offset-2"
                        >
                            Continue
                        </button>
                    </form>

                    {/* Footer */}
                    <p className="mt-5 text-center text-xs leading-relaxed text-slate-500">
                        Your information will only be used for event registration and verification.
                    </p>

                    {/* Step indicator */}
                    <div className="mt-1 flex items-center justify-center border-t border-rose-100 pt-3 text-xs">
                        <span className="font-semibold text-rose-600">
                            Step 1 of 5
                        </span>
                    </div>
                </div>
            </div>
        </main>
    );
}