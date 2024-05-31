export enum ErrorCode {
    UserNotFound = 'USER_NOT_FOUND',
    AddUserError = 'ADD_USER_ERROR',
    RemoveUserError = 'REMOVE_USER_ERROR',
    NoUserId = 'NO_USER_ID',
    NoUsername = 'NO_USER_USERNAME',
    NoMessageTimestamp = 'NO_MESSAGE_TIMESTAMP',
    NoMessage = 'NO_MESSAGE',
    MethodNotAllowed = 'METHOD_NOT_ALLOWED',
    ServerError = 'SERVER_ERROR',
}

export enum InfoCode {
    Timeout = 'TIMEOUT',
    DisconnectNotAllowed = 'DISCONNECT_NOT_ALLOWED',
    DisconnectOccured = 'DISCONNECT_OCCURED',
    ConversationNotFound = 'CONVERSATION_NOT_FOUND'
}

export const ErrorMessage: { [key in ErrorCode]: string } = {
    [ErrorCode.UserNotFound]: 'User not found.',
    [ErrorCode.AddUserError]: 'Error adding user.',
    [ErrorCode.RemoveUserError]: 'Error removing user.',
    [ErrorCode.NoUserId]: 'No user ID provided.',
    [ErrorCode.NoUsername]: 'No username provided.',
    [ErrorCode.NoMessageTimestamp]: 'No message timestamp provided.',
    [ErrorCode.NoMessage]: 'No message provided.',
    [ErrorCode.MethodNotAllowed]: 'Method not allowed.',
    [ErrorCode.ServerError]: 'Server error.',
}

export const InfoMessage: { [key in InfoCode]: string } = {
    [InfoCode.Timeout]: 'Request timed out.',
    [InfoCode.DisconnectNotAllowed]: 'Match canceled.',
    [InfoCode.DisconnectOccured]: 'Match disconnected.',
    [InfoCode.ConversationNotFound]: 'Conversation not found.',
}

export interface ErrorResponse {
    status: 'error';
    code: ErrorCode;
    message: string;
}

export interface InfoResponse {
    status: 'info';
    code: InfoCode;
    message: string;
}

export interface SuccessResponse<T> {
    status: 'success';
    data?: T;
}

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