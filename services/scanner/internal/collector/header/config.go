package header

// maxRedirects — максимальное число редиректов, за которыми следует
// ssrf.SafeDo при выполнении HEAD-запроса. Дефолт net/http — 10;
// для сканера security-заголовков 5 достаточно.
const maxRedirects = 5

var headerKeys = [...]string{
	"Content-Security-Policy",
	"Strict-Transport-Security",
	"X-Frame-Options",
}
