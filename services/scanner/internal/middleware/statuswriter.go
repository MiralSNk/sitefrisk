package middleware

import "net/http"

// statusWriter запоминает код ответа и объём тела.
//
// http.ResponseWriter умеет только писать статус, прочитать его
// обратно интерфейс не даёт. Чтобы залогировать статус после работы
// обработчика, подменяем writer своим и перехватываем вызовы.
// а что еще делать... если базовая реализация неподходит... анлак
type statusWriter struct {
	http.ResponseWriter
	status int
	bytes  int
}

// WriteHeader запоминает первый код. Повторные вызовы net/http игнорирует
// (и ругается в лог... анлак), поэтому и мы учитываем только первый.
func (w *statusWriter) WriteHeader(code int) {
	if w.status == 0 {
		w.status = code
	}
	w.ResponseWriter.WriteHeader(code)
}

// Write нужен потому, что обработчик может вообще не вызвать WriteHeader —
// тогда net/http сам подставляет 200 при первой записи тела.
func (w *statusWriter) Write(b []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	n, err := w.ResponseWriter.Write(b)
	w.bytes += n
	return n, err
}

// Status отдаёт 200, если обработчик не записал ничего вообще.
func (w *statusWriter) Status() int {
	if w.status == 0 {
		return http.StatusOK
	}
	return w.status
}
