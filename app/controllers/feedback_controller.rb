class FeedbackController < ApplicationController

    def index
    end

    def save_spreadsheet
        type = ["none","Suggest", "Like", "Dislike", "Bug"]
        params[:type] = 2
        params[:feedback_text] = "hey"
        params[:frompage] = "index.html"
        if !params.nil?
            #require "rubygems"
            require "google/api_client"
            require "google_drive"
            password = ENV['GOOGLE_PASSWORD']
            email = ENV['GOOGLE_EMAIL']
            spreadsheet = ENV['GOOGLE_SPREADSHEET']
            # Authorizes with OAuth and gets an access token.
            client = Google::APIClient.new(application_name: 'PIC', application_version: '1.0.0')
            key = Google::APIClient::KeyUtils.load_from_pkcs12(
              Rails.root.join('config', 'key.p12'),
              password
            )

            asserter = Google::APIClient::JWTAsserter.new(
              email,
              ['https://www.googleapis.com/auth/drive', 'https://spreadsheets.google.com/feeds/'],
              key
            )

            client.authorization = asserter.authorize
            auth_token = client.authorization.access_token

            session = GoogleDrive.login_with_oauth(auth_token)

            ws = session.spreadsheet_by_key(spreadsheet).worksheets[0]

            row = ws.num_rows() + 1
            string = request.env['HTTP_USER_AGENT']
            user_agent = UserAgent.parse(string)
            param_array = []
            param_array << type[params[:type].to_i].to_s << params[:feedback_text].to_s << Time.new.to_s[0..19].to_s << params[:frompage] << request.env["HTTP_X_FORWARDED_FOR"].to_s << user_agent.platform << user_agent.browser << user_agent.version
            param_array.each_with_index do |item, i|
            ws[row,i+1] = item
            end
            ws.save()

            respond_to do |format|
                format.json {
                    render :json => {:success => true}
                }
            end
        end

    end

end
