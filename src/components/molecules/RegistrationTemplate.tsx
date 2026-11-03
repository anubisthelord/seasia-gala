import React from "react";

interface EventCardProps {
    eyebrow?: string;
    title?: string;
    description?: string;
    step?: string;
    footerNote?: string;
    backgroundImage?: string;
    children: React.ReactNode;
}

export default function EventCard({
    eyebrow = "Event Registration Portal",
    title = "Seaise Gala Event",
    description = "",
    step = "",
    footerNote = "Your information will only be used for event registration and verification.",
    backgroundImage = "/background/icbg.jpg",
    children,
}: EventCardProps) {
    return (
        <main className="flex min-h-screen w-full items-center justify-center bg-white px-4 py-12">
            {/* Invitation Card — centered */}
            <div
                className="relative w-full max-w-md overflow-hidden rounded-xl border border-rose-100 bg-cover bg-top bg-no-repeat shadow-xl shadow-rose-900/10"
                style={{ backgroundImage: `url('${backgroundImage}')` }}
            >
                {/* Top image area */}
                <div className="h-24" />

                {/* Form content */}
                <div className="relative z-10 p-6 sm:p-8">
                    {/* Fixed Header */}
                    <header className="mb-6 text-center">
                        <span className="text-sm font-bold uppercase text-rose-600">
                            {title}
                        </span>

                        <h1 className="mt-1 font-serif text-xl font-medium tracking-tight text-slate-900">
                            {eyebrow}
                        </h1>

                        <p className="mx-auto mt-1 max-w-xs text-center text-xs leading-5 text-slate-500">
                            {description}
                        </p>
                    </header>

                    {/* Scrollable Content — only this changes */}
                    <div className="flex-1">
                        {children}
                    </div>

                    {/* Fixed Footer */}
                    <footer className="mt-5">
                        <p className="text-center text-xs leading-relaxed text-slate-500">
                            {footerNote}
                        </p>

                        {step && (
                            <div className="mt-1 flex items-center justify-center border-t border-rose-100 pt-3 text-xs">
                                <span className="font-semibold text-rose-600">
                                    {step}
                                </span>
                            </div>
                        )}
                    </footer>
                </div>
            </div>
        </main>
    );
}