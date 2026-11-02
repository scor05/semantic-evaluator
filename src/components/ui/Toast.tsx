import { Check } from "lucide-react";
import "./toast.css";

type ToastProps = {
    message: string;
};

export function Toast({ message }: ToastProps) {
    return (
        <div className="toast" role="status">
            <Check size={16} /> {message}
        </div>
    );
}
