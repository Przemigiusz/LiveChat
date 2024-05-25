export interface User {
    id: string;
    username: string;
}

export interface ChatMessage {
    id: string;
    sender: User;
    content: string;
    timestamp: number;
}

export interface ErrorResponse {
    status: 'error';
    message: string;
}

export interface NotAllowedResponse {
    status: 'error';
    message: string;
}

export interface SuccessResponse<T> {
    status: 'success';
    data: T;
}