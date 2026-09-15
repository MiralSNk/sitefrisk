package header

import "errors"

var (
	// ErrRequest - возвращает ошибку во время создания запроса, проверять через error.Is
	ErrRequest = errors.New("запрос не сформировался")
	// ErrResponse - возвращает ошибку в время получения запроса, проверять через error.Is
	ErrResponse = errors.New("соединение не установилась")
)
