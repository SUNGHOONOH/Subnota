import Foundation
import Supabase

enum SupabaseClientProvider {
  static let shared: SupabaseClient = {
    guard
      let urlString = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
      let url = URL(string: urlString),
      let anonKey = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String,
      !anonKey.isEmpty
    else {
      // 설정이 없으면 조용히 잘못 동작하는 것보다 즉시 죽는 편이 낫다.
      fatalError("Config.xcconfig 에 SUPABASE_URL / SUPABASE_ANON_KEY 를 넣어야 한다")
    }
    return SupabaseClient(supabaseURL: url, supabaseKey: anonKey)
  }()
}
