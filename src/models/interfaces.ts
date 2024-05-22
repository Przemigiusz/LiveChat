export interface User {
    id: string;
    username: string;
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