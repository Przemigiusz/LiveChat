export enum ErrorCode {
    MatchNotFound = 'MATCH_NOT_FOUND',
    UserNotFound = 'USER_NOT_FOUND',
    ConversationNotFound = 'CONVERSATION_NOT_FOUND',
    AddUserError = 'ADD_USER_ERROR',
    RemoveUserError = 'REMOVE_USER_ERROR',
    NoUserId = 'NO_USER_ID',
    MethodNotAllowed = 'METHOD_NOT_ALLOWED',
    ServerError = 'SERVER_ERROR',
}

export enum InfoCode {
    Timeout = 'TIMEOUT',
    DisconnectNotAllowed = 'DISCONNECT_NOT_ALLOWED',
    DisconnectOccured = 'DISCONNECT_OCCURED',
}

export const ErrorMessage: { [key in ErrorCode]: string } = {
    [ErrorCode.MatchNotFound]: 'Match not found.',
    [ErrorCode.UserNotFound]: 'User not found.',
    [ErrorCode.ConversationNotFound]: 'Conversation not found.',
    [ErrorCode.AddUserError]: 'Error adding user.',
    [ErrorCode.RemoveUserError]: 'Error removing user.',
    [ErrorCode.NoUserId]: 'No user ID provided.',
    [ErrorCode.MethodNotAllowed]: 'Method not allowed.',
    [ErrorCode.ServerError]: 'Server error.',
}

export const InfoMessage: { [key in InfoCode]: string } = {
    [InfoCode.Timeout]: 'Request timed out.',
    [InfoCode.DisconnectNotAllowed]: 'Match canceled.',
    [InfoCode.DisconnectOccured]: 'Match disconnected.',
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