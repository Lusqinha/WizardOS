<?php
declare(strict_types=1);

class ApiError extends Exception {}

const MAX_UPLOAD = 30 * 1024 * 1024;
const CATEGORIES = ['track', 'ambient', 'sfx'];

function uuid(): string { return bin2hex(random_bytes(8)); }

function yt_id(string $url): ?string {
  if (preg_match('~(?:youtube\.com/(?:watch\?v=|embed/|shorts/)|youtu\.be/)([\w-]{11})~', $url, $m)) return $m[1];
  if (preg_match('~^[\w-]{11}$~', $url)) return $url;
  return null;
}

function load(string $path): array {
  if (!is_file($path)) return ['items' => []];
  $j = json_decode((string)file_get_contents($path), true);
  return is_array($j) && isset($j['items']) && is_array($j['items']) ? $j : ['items' => []];
}

function save(string $path, array $data): void {
  file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function add_link(array $lib, array $in): array {
  $cat = (string)($in['category'] ?? '');
  if (!in_array($cat, CATEGORIES, true)) throw new ApiError('categoria invalida');
  $title = trim((string)($in['title'] ?? ''));
  if ($title === '') throw new ApiError('titulo vazio');
  $src = (string)($in['source'] ?? '');
  if ($src === 'youtube') {
    $ref = yt_id((string)($in['ref'] ?? ''));
    if ($ref === null) throw new ApiError('link do YouTube invalido');
  } elseif ($src === 'mp3url') {
    $ref = (string)($in['ref'] ?? '');
    if (!preg_match('~^https?://~i', $ref)) throw new ApiError('URL de mp3 invalida');
  } else {
    throw new ApiError('source invalido para link');
  }
  $lib['items'][] = [
    'id' => uuid(), 'category' => $cat, 'source' => $src,
    'title' => $title, 'ref' => $ref, 'loop' => $cat === 'ambient',
  ];
  return $lib;
}

function validate_upload(array $file, int $max): void {
  if ((int)($file['error'] ?? 1) !== UPLOAD_ERR_OK) throw new ApiError('falha no upload');
  if ((int)($file['size'] ?? 0) > $max) throw new ApiError('arquivo grande demais (max 30MB)');
  $mime = (new finfo(FILEINFO_MIME_TYPE))->file((string)$file['tmp_name']);
  if ($mime !== 'audio/mpeg') throw new ApiError('so arquivos mp3');
}

function record_file(array $lib, string $cat, string $title, string $filename): array {
  if (!in_array($cat, CATEGORIES, true)) throw new ApiError('categoria invalida');
  $title = trim($title);
  if ($title === '') throw new ApiError('titulo vazio');
  $lib['items'][] = [
    'id' => uuid(), 'category' => $cat, 'source' => 'mp3file',
    'title' => $title, 'ref' => $filename, 'loop' => $cat === 'ambient',
  ];
  return $lib;
}

function delete_item(array $lib, string $id, string $uploadsDir): array {
  $kept = [];
  foreach ($lib['items'] as $it) {
    if (($it['id'] ?? null) === $id) {
      if (($it['source'] ?? '') === 'mp3file') {
        $f = $uploadsDir . '/' . basename((string)$it['ref']);
        $real = realpath($f);
        if ($real !== false && str_starts_with($real, (string)realpath($uploadsDir))) @unlink($real);
      }
      continue;
    }
    $kept[] = $it;
  }
  $lib['items'] = array_values($kept);
  return $lib;
}

// Valida/normaliza um item vindo de fonte externa (import). Retorna null se invalido.
function sanitize_item(array $it): ?array {
  $cat = (string)($it['category'] ?? '');
  $src = (string)($it['source'] ?? '');
  if (!in_array($cat, CATEGORIES, true)) return null;
  if (!in_array($src, ['youtube', 'mp3url', 'mp3file'], true)) return null;
  $title = trim((string)($it['title'] ?? ''));
  if ($title === '') return null;
  $ref = (string)($it['ref'] ?? '');
  if ($src === 'youtube') { $ref = yt_id($ref) ?? ''; if ($ref === '') return null; }
  elseif ($src === 'mp3url') { if (!preg_match('~^https?://~i', $ref)) return null; }
  else { $ref = basename($ref); if ($ref === '') return null; }
  $id = (string)($it['id'] ?? '');
  return [
    'id' => $id !== '' ? $id : uuid(),
    'category' => $cat, 'source' => $src, 'title' => $title, 'ref' => $ref,
    'loop' => !empty($it['loop']),
  ];
}

// --- Router HTTP (so quando servido, nao no include do teste) ---
if (PHP_SAPI !== 'cli') {
  header('Content-Type: application/json; charset=utf-8');
  $DATA = __DIR__ . '/data/library.json';
  $UPLOADS = __DIR__ . '/uploads';
  $action = $_GET['action'] ?? '';

  $respond = fn(array $p) => print(json_encode($p, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
  try {
    $lib = load($DATA);
    switch ($action) {
      case 'list':
        $respond(['ok' => true, 'items' => $lib['items'], 'notes' => $lib['notes'] ?? '']);
        break;
      case 'save-notes':
        $in = json_decode((string)file_get_contents('php://input'), true) ?: [];
        $lib['notes'] = (string)($in['notes'] ?? '');
        save($DATA, $lib);
        $respond(['ok' => true]);
        break;
      case 'add-link':
        $in = json_decode((string)file_get_contents('php://input'), true) ?: [];
        $lib = add_link($lib, $in);
        save($DATA, $lib);
        $respond(['ok' => true, 'item' => end($lib['items'])]);
        break;
      case 'upload':
        if (!isset($_FILES['file'])) throw new ApiError('sem arquivo');
        validate_upload($_FILES['file'], MAX_UPLOAD);
        if (!is_dir($UPLOADS)) mkdir($UPLOADS, 0775, true);
        $name = uuid() . '.mp3';
        if (!move_uploaded_file($_FILES['file']['tmp_name'], "$UPLOADS/$name")) throw new ApiError('nao salvou o arquivo');
        $lib = record_file($lib, (string)($_POST['category'] ?? ''), (string)($_POST['title'] ?? ''), $name);
        save($DATA, $lib);
        $respond(['ok' => true, 'item' => end($lib['items'])]);
        break;
      case 'delete':
        $in = json_decode((string)file_get_contents('php://input'), true) ?: [];
        $lib = delete_item($lib, (string)($in['id'] ?? ''), $UPLOADS);
        save($DATA, $lib);
        $respond(['ok' => true]);
        break;
      case 'export':
        $zipPath = tempnam(sys_get_temp_dir(), 'rpgexp') . '.zip';
        $zip = new ZipArchive();
        $zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $zip->addFromString('library.json', json_encode($lib, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        foreach ($lib['items'] as $it) {
          if (($it['source'] ?? '') === 'mp3file') {
            $f = $UPLOADS . '/' . basename((string)$it['ref']);
            if (is_file($f)) $zip->addFile($f, 'uploads/' . basename((string)$it['ref']));
          }
        }
        $zip->close();
        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="rpg-soundboard.zip"');
        header('Content-Length: ' . filesize($zipPath));
        readfile($zipPath);
        unlink($zipPath);
        exit;
      case 'import':
        if (!isset($_FILES['file'])) throw new ApiError('sem arquivo');
        $zip = new ZipArchive();
        if ($zip->open((string)$_FILES['file']['tmp_name']) !== true) throw new ApiError('zip invalido');
        $json = $zip->getFromName('library.json');
        if ($json === false) throw new ApiError('library.json ausente no zip');
        $data = json_decode((string)$json, true);
        if (!is_array($data) || !isset($data['items']) || !is_array($data['items'])) throw new ApiError('library.json invalido');
        if (!is_dir($UPLOADS)) mkdir($UPLOADS, 0775, true);
        for ($i = 0; $i < $zip->numFiles; $i++) {
          $name = (string)$zip->getNameIndex($i);
          if (preg_match('~^uploads/([^/\\\\]+\.mp3)$~i', $name, $m)) {
            file_put_contents($UPLOADS . '/' . basename($m[1]), (string)$zip->getFromIndex($i));
          }
        }
        $zip->close();
        $clean = [];
        foreach ($data['items'] as $it) {
          $c = sanitize_item((array)$it);
          if ($c !== null) $clean[] = $c;
        }
        save($DATA, ['items' => $clean, 'notes' => (string)($data['notes'] ?? '')]);
        $respond(['ok' => true, 'count' => count($clean)]);
        break;
      default:
        http_response_code(404);
        $respond(['ok' => false, 'error' => 'acao desconhecida']);
    }
  } catch (ApiError $e) {
    http_response_code(400);
    $respond(['ok' => false, 'error' => $e->getMessage()]);
  } catch (Throwable $e) {
    http_response_code(500);
    $respond(['ok' => false, 'error' => 'erro interno']);
  }
}
